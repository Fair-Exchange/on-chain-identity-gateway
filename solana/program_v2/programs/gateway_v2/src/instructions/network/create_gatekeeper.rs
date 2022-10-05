use crate::constants::GATEKEEPER_SEED;
use crate::errors::GatekeeperErrors;
use crate::state::gatekeeper::{
    Gatekeeper, GatekeeperAuthKey, GatekeeperFees, GatekeeperKeyFlags, GatekeeperState,
};
use crate::state::GatekeeperNetwork;
use anchor_lang::prelude::*;

pub fn create_gatekeeper(
    ctx: Context<CreateGatekeeperAccount>,
    data: CreateGatekeeperData,
) -> Result<()> {
    let authority = &mut ctx.accounts.authority;
    let bump = *ctx.bumps.get("gatekeeper").unwrap();
    let gatekeeper = &mut ctx.accounts.gatekeeper;
    let network = &mut ctx.accounts.network;

    if data.auth_keys.is_empty() {
        return Err(error!(GatekeeperErrors::NoAuthKeys));
    }
    // Checks if there are enough auth keys to create the gatekeeper, should maybe check in NetworkKeyFlags
    if data
        .auth_keys
        .iter()
        .filter(|key| {
            GatekeeperKeyFlags::from_bits_truncate(key.flags).contains(GatekeeperKeyFlags::AUTH)
        })
        .count()
        < data.auth_threshold as usize
    {
        return Err(error!(GatekeeperErrors::InsufficientAuthKeys));
    }

    gatekeeper.authority = *authority.key;
    gatekeeper.gatekeeper_bump = bump;
    gatekeeper.gatekeeper_network = data.gatekeeper_network;
    gatekeeper.staking_account = data.staking_account;
    gatekeeper.token_fees = data.token_fees;
    gatekeeper.auth_threshold = data.auth_threshold;
    gatekeeper.auth_keys = data.auth_keys;
    gatekeeper.gatekeeper_state = GatekeeperState::Active;

    network.gatekeepers.push(gatekeeper.key());

    Ok(())
}
/// Data for [`CreateGatekeeper`]
#[derive(Debug, AnchorSerialize, AnchorDeserialize)]
pub struct CreateGatekeeperData {
    /// The [`Gatekeeper::gatekeeper_bump`].
    pub gatekeeper_bump: u8,
    /// The associated network for the gatekeeper
    pub gatekeeper_network: Pubkey,
    // staking account for the gatekeeper
    pub staking_account: Pubkey,
    // Fees for the gatekeeper
    pub token_fees: Vec<GatekeeperFees>,
    pub auth_threshold: u8,
    pub auth_keys: Vec<GatekeeperAuthKey>,
}

#[derive(Accounts, Debug)]
#[instruction(data: CreateGatekeeperData)]
pub struct CreateGatekeeperAccount<'info> {
    #[account(
        init,
        payer = authority,
        space = Gatekeeper::size(
            data.auth_keys.len(),
            data.token_fees.len(),
        ),
        seeds = [GATEKEEPER_SEED, authority.key().as_ref(), data.gatekeeper_network.key().as_ref()],
        bump
    )]
    pub gatekeeper: Account<'info, Gatekeeper>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        realloc = GatekeeperNetwork::size(
            network.fees.len(),
            network.auth_keys.len(),
            network.gatekeepers.len() + 1,
            network.supported_tokens.len(),
        ),
        realloc::payer = authority,
        realloc::zero = false,
    )]
    pub network: Account<'info, GatekeeperNetwork>,
    pub system_program: Program<'info, System>,
}
