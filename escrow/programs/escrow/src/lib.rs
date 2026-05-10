pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use instructions::*;
pub use state::*;

declare_id!("4routMSHngGLj5DbzUozx3Q9f86a5E46SsTDtj7S3Vca");

#[program]
pub mod escrow {
    use super::*;

    // Client locks USDC when approving a freelancer
    pub fn create_escrow(
        ctx: Context<CreateEscrow>,
        project_id: String,
        amount: u64,
        freelancer: Pubkey,
    ) -> Result<()> {
        create_escrow::handler(ctx, project_id, amount, freelancer)
    }

    // Client releases USDC to freelancer when work is complete
    pub fn release_payment(ctx: Context<ReleasePayment>) -> Result<()> {
        release_payment::handler(ctx)
    }

    // Client gets USDC back if job is cancelled or freelancer doesn't deliver
    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        refund::handler(ctx)
    }
}
