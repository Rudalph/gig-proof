use anchor_lang::prelude::*;

#[error_code]
pub enum EscrowError {
    #[msg("Only the client who created the escrow can perform this action")]
    Unauthorized,
    #[msg("Project ID is too long (max 64 characters)")]
    ProjectIdTooLong,
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
}
