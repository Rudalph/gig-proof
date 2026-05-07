use anchor_lang::prelude::*;

#[account]
pub struct EscrowAccount {
    pub client: Pubkey,       // wallet that locked the funds
    pub freelancer: Pubkey,   // wallet that will receive the funds
    pub amount: u64,          // amount locked (in USDC smallest unit, 6 decimals)
    pub project_id: String,   // Firestore project ID so we can link on-chain <-> off-chain
    pub bump: u8,
}

impl EscrowAccount {
    // 8 discriminator + 32 client + 32 freelancer + 8 amount + 4+64 project_id string + 1 bump
    pub const LEN: usize = 8 + 32 + 32 + 8 + (4 + 64) + 1;
}
