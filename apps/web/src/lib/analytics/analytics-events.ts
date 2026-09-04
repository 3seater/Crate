/**
 * Vercel Web Analytics custom event names and payload shape notes.
 *
 * Rules:
 * - snake_case event names; keep ≤255 chars (names, keys, string values).
 * - No PII: never send email, full wallet addresses, raw user messages, or referral codes.
 * - Low cardinality: prefer enums like `method`, `kind`, `action` over free text.
 *
 * Deduping: `trade_order_placed` is emitted from client `postOrder` success paths only
 * (not duplicated on `apps/server` tRPC). Other mutations are client-tracked on success;
 * `support_bug_report_submitted` is server-only in `app/api/report-bug` (never double with the widget).
 */

export const AnalyticsEvents = {
  authLoginSuccess: "auth_login_success",
  authLogout: "auth_logout",

  onboardingSafeRegistered: "onboarding_safe_registered",
  onboardingCredentialsStored: "onboarding_credentials_stored",
  onboardingImportSafeComplete: "onboarding_import_safe_complete",

  tradeOrderPlaced: "trade_order_placed",
  tradeOrderCancel: "trade_order_cancel",

  bridgeDepositSuccess: "bridge_deposit_success",
  bridgeWithdrawSuccess: "bridge_withdraw_success",

  safeDeploySuccess: "safe_deploy_success",
  positionSplitSuccess: "position_split_success",
  positionMergeSuccess: "position_merge_success",
  positionRedeemSuccess: "position_redeem_success",
  approvalCompleted: "approval_completed",
  clobCredentialsSynced: "clob_credentials_synced",

  watchlistToggle: "watchlist_toggle",
  watchlistCleared: "watchlist_cleared",

  walletTrackerAdd: "wallet_tracker_add",
  walletTrackerUpdate: "wallet_tracker_update",
  walletTrackerRemove: "wallet_tracker_remove",

  referralCodeUpdated: "referral_code_updated",
  referralLinkCopied: "referral_link_copied",

  notificationsDismissed: "notifications_dismissed",

  sharePnlCopied: "share_pnl_copied",
  sharePnlDownloaded: "share_pnl_downloaded",
  portfolioSnapshotDownload: "portfolio_snapshot_download",

  supportBugReportSubmitted: "support_bug_report_submitted",
} as const;
