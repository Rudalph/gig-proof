use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, CloseAccount};

use crate::state::EscrowAccount;
use crate::error::EscrowError;

#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(mut)]
    pub client: Signer<'info>,

    #[account(
        mut,
        seeds = [b"escrow", escrow_account.project_id.as_bytes(), client.key().as_ref()],
        bump = escrow_account.bump,
        has_one = client @ EscrowError::Unauthorized,
        close = client,
    )]
    pub escrow_account: Account<'info, EscrowAccount>,

    #[account(
        mut,
        seeds = [b"vault", escrow_account.key().as_ref()],
        bump,
        token::authority = escrow_account,
    )]
    pub vault: Account<'info, TokenAccount>,

    // Client's USDC token account (refund goes here)
    #[account(mut)]
    pub client_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<Refund>) -> Result<()> {
    let project_id = ctx.accounts.escrow_account.project_id.clone();
    let amount = ctx.accounts.escrow_account.amount;
    let bump = ctx.accounts.escrow_account.bump;
    let client_key = ctx.accounts.client.key();

    let seeds = &[
        b"escrow",
        project_id.as_bytes(),
        client_key.as_ref(),
        &[bump],
    ];
    let signer_seeds = &[&seeds[..]];

    // Transfer USDC from vault back to client
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.client_token_account.to_account_info(),
            authority: ctx.accounts.escrow_account.to_account_info(),
        },
        signer_seeds,
    );
    token::transfer(cpi_ctx, amount)?;

    // Close vault, return rent to client
    let close_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        CloseAccount {
            account: ctx.accounts.vault.to_account_info(),
            destination: ctx.accounts.client.to_account_info(),
            authority: ctx.accounts.escrow_account.to_account_info(),
        },
        signer_seeds,
    );
    token::close_account(close_ctx)?;

    msg!("Refund issued: {} USDC returned to client for project {}", amount, project_id);
    Ok(())
}
