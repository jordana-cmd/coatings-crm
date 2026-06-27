/**
 * Cadence thresholds (days since last contact before auto-action fires).
 * Tune these values to change drip cadence across the app.
 */

/** GC_CHASE: drip touch after N days of silence */
export const GC_CHASE_DAYS = 21;

/** FACILITY: nurture touch after N days of silence */
export const FACILITY_NURTURE_DAYS = 45;

/** Favorited contacts: default drip when no pipeline context */
export const CONTACT_DRIP_DAYS = 30;

/** "Due soon" window: actions due within this many days show as due-soon */
export const DUE_SOON_DAYS = 3;
