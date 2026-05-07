use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::state::EscrowAccount;
use crate::error::EscrowError;

#[derive(Accounts)]
#[instruction(project_id: String)]
pub struct CreateEscrow<'info> {
    #[account(mut)]
    pub client: Signer<'info>,

    /// CHECK: freelancer wallet address, validated off-chain via Firestore
    pub freelancer: UncheckedAccount<'info>,

    // The escrow account that stores job metadata on-chain
    #[account(
        init,
        payer = client,
        space = EscrowAccount::LEN,
        seeds = [b"escrow", project_id.as_bytes(), client.key().as_ref()],
        bump,
    )]
    pub escrow_account: Account<'info, EscrowAccount>,

    // Token vault PDA that holds the locked USDC
    #[account(
        init,
        payer = client,
        token::mint = usdc_mint,
        token::authority = escrow_account,
        seeds = [b"vault", escrow_account.key().as_ref()],
        bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    // Client's USDC token account (where funds come from)
    #[account(mut)]
    pub client_token_account: Account<'info, TokenAccount>,

    /// CHECK: USDC mint address
    pub usdc_mint: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<CreateEscrow>,
    project_id: String,
    amount: u64,
    freelancer: Pubkey,
) -> Result<()> {
    require!(project_id.len() <= 64, EscrowError::ProjectIdTooLong);
    require!(amount > 0, EscrowError::InvalidAmount);

    let escrow = &mut ctx.accounts.escrow_account;
    escrow.client = ctx.accounts.client.key();
    escrow.freelancer = freelancer;
    escrow.amount = amount;
    escrow.project_id = project_id;
    escrow.bump = ctx.bumps.escrow_account;

    // Transfer USDC from client's token account into the vault
    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.key(),
        Transfer {
            from: ctx.accounts.client_token_account.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.client.to_account_info(),
        },
    );
    token::transfer(cpi_ctx, amount)?;

    msg!("Escrow created: {} USDC locked for project {}", amount, escrow.project_id);
    Ok(())
}
