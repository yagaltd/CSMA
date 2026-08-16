# CSMA Events Reference (generated)

Regenerate: `npm run generate:events`. Never hand-edit.

Total event names: **491** (registered: 479).

| Event | Registered | Source | Rate limits | Publishers | Subscribers |
|---|---|---|---|---|---|
| `AB_TEST_ASSIGNED` | yes | module:ab-testing | 60/60000ms | 1 file(s) | - |
| `AB_TEST_ERROR` | yes | module:ab-testing | 60/60000ms | - | - |
| `AB_TEST_EXPOSURE` | yes | module:ab-testing | 60/60000ms | 1 file(s) | - |
| `ACCORDION_INITIALIZED` | yes | runtime | - | - | - |
| `ACCORDION_TOGGLED` | yes | runtime | - | - | - |
| `ADMIN_AUDIT_LOG_ERROR` | yes | module:admin-audit-log | 60/60000ms | - | - |
| `ADMIN_AUDIT_LOG_EXPORTED` | yes | module:admin-audit-log | 60/60000ms | 1 file(s) | - |
| `ADMIN_AUDIT_LOG_UPDATED` | yes | module:admin-audit-log | 60/60000ms | 1 file(s) | - |
| `AGENT_CONTEXT_INVALIDATED` | yes | module:agent-context | - | 1 file(s) | - |
| `AGENT_CONTEXT_QUERIED` | yes | module:agent-context | - | 1 file(s) | - |
| `AGENT_CONTEXT_REGISTERED` | yes | module:agent-context | - | 1 file(s) | - |
| `AGENT_CONTEXT_UNREGISTERED` | yes | module:agent-context | - | 1 file(s) | - |
| `AI_CHAT_CREATED` | yes | module:ai | - | 1 file(s) | - |
| `AI_CHAT_RESET` | yes | module:ai | - | 1 file(s) | - |
| `AI_CONTEXT_FAILED` | yes | module:search | - | 1 file(s) | - |
| `AI_CONTEXT_REQUESTED` | yes | module:search | ?/?ms | - | 1 file(s) |
| `AI_CONTEXT_RETRIEVED` | yes | module:search | - | 1 file(s) | - |
| `AI_GENERATE_COMPLETE` | yes | module:ai | - | - | - |
| `AI_GENERATE_ERROR` | yes | module:ai | - | - | - |
| `AI_GENERATE_STARTED` | yes | module:ai | - | - | - |
| `AI_MESSAGE_RECEIVED` | yes | module:ai | - | - | - |
| `AI_MESSAGE_SENT` | yes | module:ai | - | - | - |
| `AI_MESSAGE_STREAM` | yes | module:ai | - | - | - |
| `AI_PROVIDER_ERROR` | yes | module:ai | - | 1 file(s) | - |
| `AI_PROVIDER_REGISTERED` | yes | module:ai | - | 1 file(s) | - |
| `AI_SECURITY_VIOLATION` | yes | module:ai | - | - | - |
| `AI_TOOL_CALLED` | yes | module:ai | - | 1 file(s) | - |
| `AI_TOOL_ERROR` | yes | module:ai | - | 1 file(s) | - |
| `AI_TOOL_RESULT` | yes | module:ai | - | 1 file(s) | - |
| `ANALYTICS_BATCH_FLUSH` | yes | module:analytics | - | 1 file(s) | - |
| `ANALYTICS_CONSENT_UPDATED` | yes | module:consent | - | 1 file(s) | - |
| `ANALYTICS_EVENT` | yes | module:analytics | - | 1 file(s) | - |
| `ANALYTICS_FLUSH_ERROR` | yes | module:analytics | - | 1 file(s) | - |
| `ANALYTICS_PAGE_VIEW` | yes | module:analytics | - | 1 file(s) | - |
| `ANNOTATION_COMMENTS_LOADED` | yes | module:visual-editor | 120/60000ms | - | - |
| `ANNOTATION_COMMENT_ADDED` | yes | module:visual-editor | 120/60000ms | 1 file(s) | - |
| `ANNOTATION_COMMENT_REOPENED` | yes | module:visual-editor | 120/60000ms | - | - |
| `ANNOTATION_COMMENT_RESOLVED` | yes | module:visual-editor | 120/60000ms | - | - |
| `ANNOTATION_COMMENT_UPDATED` | yes | module:visual-editor | 120/60000ms | 1 file(s) | - |
| `ANNOTATION_UPDATED` | yes | module:slides | - | 1 file(s) | 1 file(s) |
| `API_KEY_LOGIN_SUCCEEDED` | yes | runtime | - | - | - |
| `API_REQUEST_ERROR` | yes | runtime | 600/60000ms | 1 file(s) | - |
| `API_REQUEST_RETRY` | yes | runtime | 600/60000ms | 1 file(s) | - |
| `API_REQUEST_START` | yes | runtime | 600/60000ms | 1 file(s) | - |
| `API_REQUEST_SUCCESS` | yes | runtime | 600/60000ms | 1 file(s) | - |
| `AUTH_ACCOUNT_ACTION_FAILED` | yes | module:auth | - | - | - |
| `AUTH_EMAIL_VERIFIED` | yes | module:auth | - | - | - |
| `AUTH_ERROR` | yes | runtime | - | - | - |
| `AUTH_LOGIN_FAILED` | yes | runtime | - | - | 1 file(s) |
| `AUTH_LOGIN_SUCCEEDED` | yes | runtime | - | - | - |
| `AUTH_OAUTH_COMPLETED` | yes | module:auth | - | - | - |
| `AUTH_OAUTH_FAILED` | yes | module:auth | - | - | - |
| `AUTH_OAUTH_STARTED` | yes | module:auth | - | - | - |
| `AUTH_PASSWORD_RESET_COMPLETED` | yes | module:auth | - | - | - |
| `AUTH_PASSWORD_RESET_REQUESTED` | yes | module:auth | - | - | - |
| `AUTH_SESSION_UPDATED` | yes | module:auth | - | - | 2 file(s) |
| `AUTH_VERIFICATION_RESENT` | yes | module:auth | - | - | - |
| `BUILD_ADVANCED` | yes | module:slides | - | 1 file(s) | 2 file(s) |
| `CACHE_HIT` | yes | runtime | - | 1 file(s) | - |
| `CACHE_INVALIDATED` | yes | runtime | - | 1 file(s) | - |
| `CACHE_MISS` | yes | runtime | - | 1 file(s) | - |
| `CACHE_PERSIST_FAILED` | yes | runtime | 600/60000ms | 1 file(s) | - |
| `CACHE_SET` | yes | runtime | - | 1 file(s) | - |
| `CALENDAR_RENDERED` | yes | runtime | - | - | - |
| `CAMERA_CAPTURE_COMPLETED` | yes | module:media | - | - | - |
| `CAMERA_CAPTURE_ERROR` | yes | module:media | - | - | - |
| `CAPTCHA_SOLVED` | yes | module:captcha | - | - | - |
| `CART_ERROR` | yes | module:cart | 60/60000ms | 1 file(s) | - |
| `CART_ITEM_REMOVED` | yes | module:cart | 60/60000ms | 1 file(s) | - |
| `CART_UPDATED` | yes | module:cart | 60/60000ms | 1 file(s) | - |
| `CATALOG_ERROR` | yes | module:catalog | 60/60000ms | 1 file(s) | - |
| `CATALOG_FILTERS_CHANGED` | yes | module:catalog | 60/60000ms | 1 file(s) | - |
| `CATALOG_ITEMS_UPDATED` | yes | module:catalog | 60/60000ms | 1 file(s) | - |
| `CATALOG_ITEM_SELECTED` | yes | module:catalog | 60/60000ms | 1 file(s) | - |
| `CHANNEL_ACCESS_DENIED` | yes | module:optimistic-sync | - | 1 file(s) | - |
| `CHANNEL_ACCESS_REVOKED` | yes | runtime | 600/60000ms | 1 file(s) | - |
| `CHANNEL_COMMAND_REQUEST` | yes | runtime | 600/60000ms | 1 file(s) | 1 file(s) |
| `CHANNEL_COMMAND_RESULT` | yes | module:optimistic-sync | - | 1 file(s) | - |
| `CHANNEL_SERVER_CLOSE` | yes | runtime | 600/60000ms | 2 file(s) | - |
| `CHANNEL_SERVER_EVENT` | yes | module:optimistic-sync | - | 1 file(s) | - |
| `CHANNEL_SERVER_INVALIDATE` | yes | module:optimistic-sync | - | 1 file(s) | 1 file(s) |
| `CHANNEL_SERVER_REPLAY` | yes | module:optimistic-sync | - | 1 file(s) | 1 file(s) |
| `CHANNEL_SERVER_SNAPSHOT` | yes | module:optimistic-sync | - | 1 file(s) | 1 file(s) |
| `CHANNEL_SUBSCRIBED` | yes | runtime | 600/60000ms | 1 file(s) | 1 file(s) |
| `CHANNEL_UNSUBSCRIBED` | yes | runtime | 600/60000ms | 1 file(s) | 1 file(s) |
| `CHARTS_ERROR` | yes | module:charts | 60/60000ms | - | - |
| `CHARTS_UPDATED` | yes | module:charts | 60/60000ms | 1 file(s) | 1 file(s) |
| `CHART_ADAPTER_READY` | yes | module:charts | 60/60000ms | 1 file(s) | - |
| `CHECKOUT_COMPLETED` | yes | module:checkout | - | 1 file(s) | - |
| `CHECKOUT_ERROR` | yes | module:checkout | - | 1 file(s) | - |
| `CHECKOUT_STATE_CHANGED` | yes | module:checkout | - | 1 file(s) | - |
| `CMS_CONTENT_ERROR` | yes | module:cms-content | 60/60000ms | 1 file(s) | - |
| `CMS_CONTENT_LOADED` | yes | module:cms-content | 60/60000ms | 1 file(s) | - |
| `CMS_CONTENT_PREFETCHED` | yes | module:cms-content | 60/60000ms | 1 file(s) | - |
| `COMMAND_CLOSED` | yes | runtime | - | - | - |
| `COMMAND_EXECUTED` | yes | runtime | - | 1 file(s) | - |
| `COMMAND_OPENED` | yes | runtime | - | - | - |
| `COMMAND_RESULTS_UPDATED` | yes | runtime | - | 1 file(s) | - |
| `COMMENTS_DRAWER_CLOSED` | yes | module:comments | - | - | - |
| `COMMENTS_DRAWER_OPENED` | yes | module:comments | - | - | - |
| `COMMENTS_ERROR` | yes | module:comments | 60/60000ms | - | - |
| `COMMENTS_PICK_MODE` | yes | module:comments | - | 1 file(s) | - |
| `COMMENTS_UPDATED` | yes | module:comments | 60/60000ms | 1 file(s) | 1 file(s) |
| `COMMENT_ADDED` | yes | module:comments | - | - | - |
| `COMMENT_COUNT_CHANGED` | yes | module:comments | - | - | 2 file(s) |
| `COMMENT_REMOVED` | yes | module:comments | - | - | 1 file(s) |
| `COMMENT_REOPENED` | yes | module:comments | - | - | 1 file(s) |
| `COMMENT_RESOLVED` | yes | module:comments | - | - | 1 file(s) |
| `COMMENT_SUBMITTED` | yes | module:comments | 60/60000ms | 1 file(s) | - |
| `COMMENT_UPDATED` | yes | module:comments | - | - | - |
| `CONSENT_ACKNOWLEDGED` | yes | module:consent | - | 1 file(s) | - |
| `CONSENT_RESET` | yes | module:consent | - | 1 file(s) | - |
| `CONSENT_UPDATED` | yes | module:consent | - | 1 file(s) | - |
| `CONTENT_PREFETCH_COMPLETED` | yes | module:content-prefetch | 60/60000ms | 1 file(s) | - |
| `CONTENT_PREFETCH_ERROR` | yes | module:content-prefetch | 60/60000ms | 1 file(s) | - |
| `CONTENT_PREFETCH_READY` | yes | module:content-prefetch | 60/60000ms | 1 file(s) | - |
| `CONTENT_WORKFLOW_ERROR` | yes | module:content-workflow | 60/60000ms | 1 file(s) | - |
| `CONTENT_WORKFLOW_TRANSITIONED` | yes | module:content-workflow | 60/60000ms | 1 file(s) | - |
| `CONTENT_WORKFLOW_UPDATED` | yes | module:content-workflow | 60/60000ms | 1 file(s) | - |
| `CONTRACT_VIOLATION` | yes | runtime | - | - | - |
| `DATA_AGGREGATION_COMPLETED` | yes | runtime | 600/60000ms | 1 file(s) | - |
| `DATA_AGGREGATION_FAILED` | yes | runtime | 600/60000ms | 1 file(s) | - |
| `DATA_AGGREGATION_STARTED` | yes | runtime | 600/60000ms | 1 file(s) | - |
| `DATA_TABLE_ERROR` | yes | module:data-table | - | 1 file(s) | - |
| `DATA_TABLE_UPDATED` | yes | module:data-table | - | 1 file(s) | - |
| `DATE_SELECTED` | yes | runtime | - | - | - |
| `DECK_DESTROYED` | yes | module:slides | - | 1 file(s) | - |
| `DECK_EXPORT_COMPLETED` | yes | module:slides | - | - | - |
| `DECK_READY` | yes | module:slides | - | 1 file(s) | 2 file(s) |
| `DIRECTORY_COLLAPSED` | yes | module:file-explorer | - | 1 file(s) | - |
| `DIRECTORY_EXPANDED` | yes | module:file-explorer | - | 1 file(s) | - |
| `DIRECTORY_OPENED` | yes | module:file-explorer | - | 1 file(s) | - |
| `DROPDOWN_CLOSED` | yes | runtime | - | - | - |
| `DROPDOWN_INITIALIZED` | yes | runtime | - | - | - |
| `DROPDOWN_OPENED` | yes | runtime | - | - | - |
| `DROPDOWN_TOGGLED` | yes | runtime | - | - | - |
| `EDGE_SEARCH_ERROR` | yes | module:edge-search | 60/60000ms | 1 file(s) | - |
| `EDGE_SEARCH_RESULTS` | yes | module:edge-search | 60/60000ms | 1 file(s) | - |
| `EDGE_SEARCH_SUGGESTIONS` | yes | module:edge-search | 60/60000ms | 1 file(s) | - |
| `EDITOR_COMMAND_ERROR` | yes | module:visual-editor | - | 1 file(s) | - |
| `EDITOR_DOCUMENT_CHANGED` | yes | module:visual-editor | - | 1 file(s) | 2 file(s) |
| `EDITOR_ERROR` | yes | module:visual-editor | - | - | - |
| `EDITOR_READY` | yes | module:visual-editor | - | 1 file(s) | - |
| `EDITOR_SELECTION_CHANGED` | yes | module:visual-editor | - | 1 file(s) | 2 file(s) |
| `EDITOR_STATE` | yes | module:visual-editor | - | 1 file(s) | - |
| `EXAMPLE_MODULE_EVENT` | **NO** | - | - | 1 file(s) | - |
| `EXAMPLE_MODULE_VIEW_RENDERED` | **NO** | - | - | 1 file(s) | - |
| `EXPORT_READY` | yes | module:import-export | 60/60000ms | 1 file(s) | - |
| `FEATURE_FLAGS_ERROR` | yes | module:feature-flags | 60/60000ms | 1 file(s) | - |
| `FEATURE_FLAGS_READY` | yes | module:feature-flags | 60/60000ms | 1 file(s) | - |
| `FEATURE_FLAG_CHANGED` | yes | module:feature-flags | 60/60000ms | 1 file(s) | - |
| `FIELD_VALIDATION_FAILED` | yes | runtime | 600/60000ms | 1 file(s) | - |
| `FIELD_VALIDATION_PASSED` | yes | runtime | 600/60000ms | 1 file(s) | - |
| `FIELD_VALIDATION_STARTED` | yes | runtime | 600/60000ms | 1 file(s) | - |
| `FILE_DELETED` | yes | module:file-system | - | 1 file(s) | - |
| `FILE_EXPLORER_ERROR` | yes | module:file-explorer | - | 1 file(s) | - |
| `FILE_OPENED` | yes | module:file-explorer | - | - | - |
| `FILE_REMOVED` | yes | runtime | - | 1 file(s) | 1 file(s) |
| `FILE_RETRIEVED` | yes | module:file-system | - | 1 file(s) | - |
| `FILE_STORED` | yes | module:file-system | - | 1 file(s) | - |
| `FILE_SYSTEM_ERROR` | yes | module:file-system | - | 1 file(s) | - |
| `FILE_UPLOAD_CANCELLED` | yes | module:file-upload | - | 1 file(s) | 1 file(s) |
| `FILE_UPLOAD_COMPLETED` | yes | runtime | - | 1 file(s) | 1 file(s) |
| `FILE_UPLOAD_FAILED` | yes | runtime | - | 1 file(s) | 1 file(s) |
| `FILE_UPLOAD_PAUSED` | yes | module:file-upload | - | 1 file(s) | 1 file(s) |
| `FILE_UPLOAD_PROGRESS` | yes | runtime | - | 1 file(s) | 1 file(s) |
| `FILE_UPLOAD_RESUMED` | yes | module:file-upload | - | 1 file(s) | 1 file(s) |
| `FILE_UPLOAD_RETRIED` | yes | module:file-upload | - | 1 file(s) | - |
| `FILE_UPLOAD_STARTED` | yes | runtime | - | 1 file(s) | 1 file(s) |
| `FORM_ERROR` | yes | module:form-management | - | 1 file(s) | - |
| `FORM_FIELD_UPDATED` | yes | module:form-management | - | 1 file(s) | - |
| `FORM_STATE_CHANGED` | yes | module:form-management | - | 1 file(s) | - |
| `FORM_SUBMITTED` | yes | module:form-management | - | 1 file(s) | - |
| `FORM_VALIDATION_FAILED` | yes | runtime | 600/60000ms | 1 file(s) | - |
| `FORM_VALIDATION_PASSED` | yes | runtime | 600/60000ms | 1 file(s) | - |
| `GEOFENCE_TRIGGERED` | yes | module:location | - | 1 file(s) | - |
| `HISTORY_LOG_READY` | yes | module:history | - | 1 file(s) | - |
| `HISTORY_OP_RECORDED` | yes | module:history | - | 2 file(s) | - |
| `HISTORY_OP_REDONE` | yes | module:history | - | 2 file(s) | - |
| `HISTORY_OP_UNDONE` | yes | module:history | - | 2 file(s) | - |
| `HMAC_NONCE_REQUESTED` | yes | runtime | - | - | - |
| `HMAC_VERIFICATION_FAILED` | yes | runtime | - | - | - |
| `IMAGE_OPTIMIZE_COMPLETED` | yes | module:media | - | - | - |
| `IMAGE_OPTIMIZE_ERROR` | yes | module:media | - | - | - |
| `IMPORT_EXPORT_ERROR` | yes | module:import-export | 60/60000ms | - | - |
| `IMPORT_PREVIEW_READY` | yes | module:import-export | 60/60000ms | 1 file(s) | - |
| `INPUT_VALIDATION_FAILED` | yes | runtime | - | - | - |
| `INTENT_AB_TEST_ASSIGN` | yes | module:ab-testing | 60/60000ms | - | 1 file(s) |
| `INTENT_AB_TEST_EXPOSE` | yes | module:ab-testing | 60/60000ms | - | 1 file(s) |
| `INTENT_AB_TEST_RESET` | yes | module:ab-testing | 60/60000ms | - | 1 file(s) |
| `INTENT_ACCORDION_TOGGLE` | yes | runtime | 60/60000ms | - | - |
| `INTENT_ADMIN_AUDIT_LOG_EXPORT` | yes | module:admin-audit-log | 60/60000ms | - | 1 file(s) |
| `INTENT_ADMIN_AUDIT_LOG_FILTER` | yes | module:admin-audit-log | 60/60000ms | - | 1 file(s) |
| `INTENT_ADMIN_AUDIT_LOG_LOAD` | yes | module:admin-audit-log | 60/60000ms | - | 1 file(s) |
| `INTENT_ALERT_DIALOG_CLOSE` | yes | runtime | 60/60000ms | - | - |
| `INTENT_ALERT_DIALOG_OPEN` | yes | runtime | 60/60000ms | - | - |
| `INTENT_ANNOTATION_CLEAR` | yes | module:slides | 5/1000ms | - | - |
| `INTENT_ANNOTATION_COMMENT_ADD` | yes | module:visual-editor | 30/60000ms | - | - |
| `INTENT_ANNOTATION_COMMENT_EDIT` | yes | module:visual-editor | 30/60000ms | - | - |
| `INTENT_ANNOTATION_COMMENT_REOPEN` | yes | module:visual-editor | 30/60000ms | - | - |
| `INTENT_ANNOTATION_COMMENT_REPLY` | yes | module:visual-editor | 30/60000ms | - | - |
| `INTENT_ANNOTATION_COMMENT_RESOLVE` | yes | module:visual-editor | 30/60000ms | - | - |
| `INTENT_ANNOTATION_STROKE` | yes | module:slides | 120/1000ms | 1 file(s) | 1 file(s) |
| `INTENT_ANNOTATION_STROKE_DELETE` | yes | module:slides | 5/1000ms | 2 file(s) | 1 file(s) |
| `INTENT_ANNOTATION_UNDO` | yes | module:slides | 5/1000ms | - | - |
| `INTENT_AUTH_FORGOT_PASSWORD` | yes | module:auth | - | - | 1 file(s) |
| `INTENT_AUTH_HANDLE_OAUTH_CALLBACK` | yes | module:auth | - | - | 1 file(s) |
| `INTENT_AUTH_LOGIN` | yes | runtime | 60/60000ms | - | 1 file(s) |
| `INTENT_AUTH_LOGOUT` | yes | module:auth | - | - | 1 file(s) |
| `INTENT_AUTH_REFRESH_SESSION` | yes | module:auth | - | - | 1 file(s) |
| `INTENT_AUTH_REGISTER` | yes | module:auth | - | - | 1 file(s) |
| `INTENT_AUTH_RESEND_VERIFICATION` | yes | module:auth | - | - | 1 file(s) |
| `INTENT_AUTH_RESET_PASSWORD` | yes | module:auth | - | - | 1 file(s) |
| `INTENT_AUTH_START_OAUTH` | yes | module:auth | - | - | 1 file(s) |
| `INTENT_AUTH_VERIFY_EMAIL` | yes | module:auth | - | - | 1 file(s) |
| `INTENT_BUTTON_CLICKED` | yes | runtime | 60/60000ms | - | - |
| `INTENT_CAMERA_CAPTURE_PHOTO` | yes | module:media | - | - | 1 file(s) |
| `INTENT_CAMERA_CAPTURE_VIDEO_START` | yes | module:media | - | - | 1 file(s) |
| `INTENT_CAMERA_CAPTURE_VIDEO_STOP` | yes | module:media | - | - | 1 file(s) |
| `INTENT_CART_ADD_ITEM` | yes | module:cart | 60/60000ms | - | 1 file(s) |
| `INTENT_CART_CLEAR` | yes | module:cart | 60/60000ms | - | 1 file(s) |
| `INTENT_CART_UPDATE_ITEM` | yes | module:cart | 60/60000ms | - | 1 file(s) |
| `INTENT_CATALOG_FILTER` | yes | module:catalog | 60/60000ms | - | 1 file(s) |
| `INTENT_CATALOG_LOAD` | yes | module:catalog | 60/60000ms | - | 1 file(s) |
| `INTENT_CATALOG_SELECT_ITEM` | yes | module:catalog | 60/60000ms | - | 1 file(s) |
| `INTENT_CHART_CLEAR` | yes | module:charts | 60/60000ms | - | 1 file(s) |
| `INTENT_CHART_REGISTER_ADAPTER` | yes | module:charts | 60/60000ms | - | 1 file(s) |
| `INTENT_CHART_SET_DATA` | yes | module:charts | 60/60000ms | - | 1 file(s) |
| `INTENT_CHECKOUT_RESET` | yes | module:checkout | - | - | 1 file(s) |
| `INTENT_CHECKOUT_START` | yes | module:checkout | - | - | 1 file(s) |
| `INTENT_CHECKOUT_SUBMIT` | yes | module:checkout | - | - | 1 file(s) |
| `INTENT_CMS_CONTENT_LOAD` | yes | module:cms-content | 60/60000ms | - | 1 file(s) |
| `INTENT_CMS_CONTENT_PREFETCH` | yes | module:cms-content | 60/60000ms | - | 1 file(s) |
| `INTENT_COMMAND_CLOSE` | yes | runtime | 60/60000ms | - | - |
| `INTENT_COMMAND_EXECUTE` | yes | runtime | 60/60000ms | - | 1 file(s) |
| `INTENT_COMMAND_OPEN` | yes | runtime | 60/60000ms | - | - |
| `INTENT_COMMAND_SEARCH` | yes | runtime | 60/60000ms | - | 1 file(s) |
| `INTENT_COMMENTS_CLOSE_DRAWER` | yes | module:comments | 10/1000ms | - | - |
| `INTENT_COMMENTS_FOCUS` | yes | module:comments | 10/1000ms | 2 file(s) | 1 file(s) |
| `INTENT_COMMENTS_LOAD` | yes | module:comments | 60/60000ms | - | 1 file(s) |
| `INTENT_COMMENTS_OPEN_DRAWER` | yes | module:comments | 10/1000ms | 1 file(s) | - |
| `INTENT_COMMENTS_START_PICK` | yes | module:comments | 10/1000ms | 1 file(s) | - |
| `INTENT_COMMENT_ADD` | yes | module:comments | 20/1000ms | 3 file(s) | - |
| `INTENT_COMMENT_DELETE` | yes | module:comments | 20/1000ms | 2 file(s) | - |
| `INTENT_COMMENT_EDIT` | yes | module:comments | 20/1000ms | 1 file(s) | - |
| `INTENT_COMMENT_MODERATE` | yes | module:comments | 60/60000ms | - | 1 file(s) |
| `INTENT_COMMENT_REOPEN` | yes | module:comments | 20/1000ms | 2 file(s) | - |
| `INTENT_COMMENT_REPLY` | yes | module:comments | 20/1000ms | 1 file(s) | - |
| `INTENT_COMMENT_RESOLVE` | yes | module:comments | 20/1000ms | 2 file(s) | - |
| `INTENT_COMMENT_SUBMIT` | yes | module:comments | 60/60000ms | - | 1 file(s) |
| `INTENT_CONSENT_ACCEPT_ALL` | yes | module:consent | - | - | 1 file(s) |
| `INTENT_CONSENT_REJECT_OPTIONAL` | yes | module:consent | - | - | 1 file(s) |
| `INTENT_CONSENT_UPDATE` | yes | module:consent | - | - | 1 file(s) |
| `INTENT_CONTENT_PREFETCH_MANIFEST` | yes | module:content-prefetch | 60/60000ms | - | 1 file(s) |
| `INTENT_CONTENT_PREFETCH_ROUTE` | yes | module:content-prefetch | 60/60000ms | - | 1 file(s) |
| `INTENT_CONTENT_WORKFLOW_CLEAR` | yes | module:content-workflow | 60/60000ms | - | 1 file(s) |
| `INTENT_CONTENT_WORKFLOW_SET` | yes | module:content-workflow | 60/60000ms | - | 1 file(s) |
| `INTENT_CONTENT_WORKFLOW_TRANSITION` | yes | module:content-workflow | 60/60000ms | - | 1 file(s) |
| `INTENT_DATA_TABLE_FILTER` | yes | module:data-table | - | - | 1 file(s) |
| `INTENT_DATA_TABLE_LOAD` | yes | module:data-table | - | - | 1 file(s) |
| `INTENT_DATA_TABLE_SORT` | yes | module:data-table | - | - | 1 file(s) |
| `INTENT_DECK_EXPORT_PNG` | yes | module:slides | 2/1000ms | - | - |
| `INTENT_DRAWER_CLOSE` | yes | runtime | 60/60000ms | - | - |
| `INTENT_DRAWER_OPEN` | yes | runtime | 60/60000ms | - | - |
| `INTENT_DROPDOWN_ITEM_SELECT` | yes | runtime | 60/60000ms | - | - |
| `INTENT_DROPDOWN_ITEM_SELECTED` | yes | runtime | 60/60000ms | - | - |
| `INTENT_DROPDOWN_TOGGLE` | yes | runtime | 60/60000ms | - | - |
| `INTENT_EDGE_SEARCH_QUERY` | yes | module:edge-search | 60/60000ms | - | 1 file(s) |
| `INTENT_EDGE_SEARCH_RESET` | yes | module:edge-search | 60/60000ms | - | 1 file(s) |
| `INTENT_EDGE_SEARCH_SUGGEST` | yes | module:edge-search | 60/60000ms | - | 1 file(s) |
| `INTENT_EDITOR_COMMAND` | yes | module:visual-editor | 60/60000ms | - | 1 file(s) |
| `INTENT_EDITOR_DESTROY` | yes | module:visual-editor | 10/60000ms | - | 1 file(s) |
| `INTENT_EDITOR_GET_STATE` | yes | module:visual-editor | 60/60000ms | - | 1 file(s) |
| `INTENT_EDITOR_INIT` | yes | module:visual-editor | 10/60000ms | - | 1 file(s) |
| `INTENT_ELEMENT_EDITED` | yes | module:slides | - | 1 file(s) | 1 file(s) |
| `INTENT_EXPORT_PREPARE` | yes | module:import-export | 60/60000ms | - | 1 file(s) |
| `INTENT_FEATURE_FLAGS_REFRESH` | yes | module:feature-flags | 60/60000ms | - | 1 file(s) |
| `INTENT_FEATURE_FLAG_SET` | yes | module:feature-flags | 60/60000ms | - | 1 file(s) |
| `INTENT_FILE_UPLOAD` | yes | runtime | 60/60000ms | - | 1 file(s) |
| `INTENT_FILE_UPLOAD_CANCEL` | yes | module:file-upload | - | - | 1 file(s) |
| `INTENT_FILE_UPLOAD_PAUSE` | yes | module:file-upload | - | - | 1 file(s) |
| `INTENT_FILE_UPLOAD_RESUME` | yes | module:file-upload | - | - | 1 file(s) |
| `INTENT_FILE_UPLOAD_RETRY` | yes | module:file-upload | - | - | 1 file(s) |
| `INTENT_FORM_REGISTER` | yes | module:form-management | 30/60000ms | - | 1 file(s) |
| `INTENT_FORM_RESET` | yes | module:form-management | 30/60000ms | - | 1 file(s) |
| `INTENT_FORM_SUBMIT` | yes | module:form-management | 10/60000ms | - | 1 file(s) |
| `INTENT_FORM_UPDATE_FIELD` | yes | module:form-management | 30/60000ms | - | 1 file(s) |
| `INTENT_GEOFENCE_ADD` | yes | module:location | - | - | 1 file(s) |
| `INTENT_GEOFENCE_REMOVE` | yes | module:location | - | - | 1 file(s) |
| `INTENT_IMAGE_OPTIMIZE` | yes | module:media | - | - | 1 file(s) |
| `INTENT_IMPORT_EXPORT_RESET` | yes | module:import-export | 60/60000ms | - | 1 file(s) |
| `INTENT_IMPORT_PREVIEW` | yes | module:import-export | 60/60000ms | - | 1 file(s) |
| `INTENT_INPUT_CHANGED` | yes | runtime | 60/60000ms | - | - |
| `INTENT_LOCATION_START` | yes | module:location | - | - | 1 file(s) |
| `INTENT_LOCATION_STOP` | yes | module:location | - | - | 1 file(s) |
| `INTENT_MEDIA_CAPTURE_AUDIO_START` | yes | module:media | - | - | 1 file(s) |
| `INTENT_MEDIA_CAPTURE_AUDIO_STOP` | yes | module:media | - | - | 1 file(s) |
| `INTENT_MEDIA_CAPTURE_CANCEL` | yes | module:media | - | - | 1 file(s) |
| `INTENT_MEDIA_CAPTURE_PHOTO` | yes | module:media | - | - | 1 file(s) |
| `INTENT_MEDIA_CAPTURE_SCREEN_START` | yes | module:media | - | - | 1 file(s) |
| `INTENT_MEDIA_CAPTURE_SCREEN_STOP` | yes | module:media | - | - | 1 file(s) |
| `INTENT_MEDIA_CAPTURE_START` | yes | module:media | - | - | 1 file(s) |
| `INTENT_MEDIA_CAPTURE_STOP` | yes | module:media | - | - | 1 file(s) |
| `INTENT_MEDIA_CAPTURE_VIDEO_START` | yes | module:media | - | - | 1 file(s) |
| `INTENT_MEDIA_CAPTURE_VIDEO_STOP` | yes | module:media | - | - | 1 file(s) |
| `INTENT_MEDIA_OPTIMIZE` | yes | module:media | - | - | 1 file(s) |
| `INTENT_MEDIA_RESIZE` | yes | module:media | - | - | 1 file(s) |
| `INTENT_MEDIA_TRANSFORM` | yes | module:media | - | - | 1 file(s) |
| `INTENT_MODAL_CLOSE` | yes | runtime | 60/60000ms | - | 1 file(s) |
| `INTENT_MODAL_CLOSE_ALL` | yes | module:modal-system | - | - | 1 file(s) |
| `INTENT_MODAL_OPEN` | yes | runtime | 60/60000ms | - | 1 file(s) |
| `INTENT_NETWORK_STATUS_REFRESH` | yes | module:network-status | - | - | 1 file(s) |
| `INTENT_NOTIFICATIONS_CLEAR` | yes | module:notifications | - | - | 1 file(s) |
| `INTENT_NOTIFICATIONS_CLOSE_CENTER` | yes | module:notifications | - | - | 1 file(s) |
| `INTENT_NOTIFICATIONS_ENQUEUE` | yes | module:notifications | - | - | 1 file(s) |
| `INTENT_NOTIFICATIONS_MARK_ALL_READ` | yes | module:notifications | - | - | 1 file(s) |
| `INTENT_NOTIFICATIONS_MARK_READ` | yes | module:notifications | - | - | 1 file(s) |
| `INTENT_NOTIFICATIONS_OPEN_CENTER` | yes | module:notifications | - | - | 1 file(s) |
| `INTENT_NOTIFICATIONS_REMOVE` | yes | module:notifications | - | - | 1 file(s) |
| `INTENT_NOTIFICATIONS_REQUEST_PERMISSION` | yes | module:notifications | - | - | 1 file(s) |
| `INTENT_NOTIFICATIONS_SUBSCRIBE_PUSH` | yes | module:notifications | - | - | 1 file(s) |
| `INTENT_NOTIFICATIONS_UNSUBSCRIBE_PUSH` | yes | module:notifications | - | - | 1 file(s) |
| `INTENT_PAGINATION_NAVIGATE` | yes | runtime | 60/60000ms | - | - |
| `INTENT_PAYMENT_ADAPTER_REGISTER` | yes | module:payment-adapters | 60/60000ms | - | 1 file(s) |
| `INTENT_PAYMENT_FLOW_RESET` | yes | module:payment-adapters | 60/60000ms | - | 1 file(s) |
| `INTENT_PAYMENT_FLOW_START` | yes | module:payment-adapters | 60/60000ms | - | 1 file(s) |
| `INTENT_PERMISSIONS_UI_CHECK` | yes | module:permissions-ui | 60/60000ms | - | 1 file(s) |
| `INTENT_PERMISSIONS_UI_CLEAR` | yes | module:permissions-ui | 60/60000ms | - | 1 file(s) |
| `INTENT_PERMISSIONS_UI_SET` | yes | module:permissions-ui | 60/60000ms | - | 1 file(s) |
| `INTENT_POPOVER_TOGGLE` | yes | runtime | 60/60000ms | - | - |
| `INTENT_PROGRESS_UPDATE` | yes | runtime | 60/60000ms | - | - |
| `INTENT_PUBLIC_FORM_SUBMIT` | yes | runtime | 60/60000ms | 1 file(s) | - |
| `INTENT_REDO` | yes | module:slides | 5/1000ms | 1 file(s) | 1 file(s) |
| `INTENT_REVIEWS_LOAD` | yes | module:reviews | 60/60000ms | - | 1 file(s) |
| `INTENT_REVIEW_RESET` | yes | module:reviews | 60/60000ms | - | 1 file(s) |
| `INTENT_REVIEW_SUBMIT` | yes | module:reviews | 60/60000ms | - | 1 file(s) |
| `INTENT_ROUTE_NAVIGATE` | yes | module:router | - | - | 1 file(s) |
| `INTENT_SLIDER_DRAG_ENDED` | yes | runtime | 60/60000ms | - | - |
| `INTENT_SLIDER_DRAG_STARTED` | yes | runtime | 60/60000ms | - | - |
| `INTENT_SLIDER_VALUE_CHANGED` | yes | runtime | 60/60000ms | - | - |
| `INTENT_SLIDE_ESCAPE` | yes | module:slides | 5/1000ms | 1 file(s) | - |
| `INTENT_SLIDE_FIRST` | yes | module:slides | 5/1000ms | - | - |
| `INTENT_SLIDE_GO` | yes | module:slides | 5/1000ms | 3 file(s) | - |
| `INTENT_SLIDE_HIDE_UI` | yes | module:slides | 5/1000ms | - | - |
| `INTENT_SLIDE_LAST` | yes | module:slides | 5/1000ms | - | - |
| `INTENT_SLIDE_NEXT` | yes | module:slides | 10/1000ms | - | - |
| `INTENT_SLIDE_NOTE_UPDATE` | yes | module:slides | 10/1000ms | 1 file(s) | - |
| `INTENT_SLIDE_OPEN_PRESENTER` | yes | module:slides | 2/1000ms | - | - |
| `INTENT_SLIDE_PREV` | yes | module:slides | 10/1000ms | - | - |
| `INTENT_SLIDE_TOGGLE_COMMENTS` | yes | module:slides | 5/1000ms | - | - |
| `INTENT_SLIDE_TOGGLE_DRAWING` | yes | module:slides | 5/1000ms | - | - |
| `INTENT_SLIDE_TOGGLE_FS` | yes | module:slides | 3/1000ms | - | - |
| `INTENT_SLIDE_TOGGLE_GRID` | yes | module:slides | 5/1000ms | - | - |
| `INTENT_SLIDE_TOGGLE_RAIL` | yes | module:slides | 5/1000ms | - | - |
| `INTENT_SYNC_QUEUE_ENQUEUE` | yes | module:sync-queue | - | - | 1 file(s) |
| `INTENT_TAB_SWITCH` | yes | runtime | 60/60000ms | - | - |
| `INTENT_TOAST_SHOW` | yes | runtime | 60/60000ms | 2 file(s) | 1 file(s) |
| `INTENT_TODO_CLEAR_COMPLETED` | **NO** | - | - | 1 file(s) | 1 file(s) |
| `INTENT_TODO_CREATE` | **NO** | - | - | 1 file(s) | 1 file(s) |
| `INTENT_TODO_DELETE` | **NO** | - | - | 1 file(s) | 1 file(s) |
| `INTENT_TODO_FILTER` | **NO** | - | - | 1 file(s) | 1 file(s) |
| `INTENT_TODO_TOGGLE` | **NO** | - | - | 1 file(s) | 1 file(s) |
| `INTENT_TODO_UPDATE` | **NO** | - | - | 1 file(s) | 1 file(s) |
| `INTENT_UNDO` | yes | module:slides | 5/1000ms | 1 file(s) | 1 file(s) |
| `INTENT_VIEW_RENDER` | yes | runtime | 60/60000ms | - | 1 file(s) |
| `INTENT_WEBMCP_EXPOSE_TOOLS` | yes | module:webmcp | 10/60000ms | - | 1 file(s) |
| `ISLAND_INVALIDATED` | yes | module:optimistic-sync | - | 1 file(s) | - |
| `ITEM_SAVED` | **NO** | - | - | 1 file(s) | - |
| `LANGUAGE_CHANGED` | yes | module:i18n | - | 1 file(s) | 1 file(s) |
| `LEADER_STATE_CHANGED` | yes | runtime | 600/60000ms | 1 file(s) | 1 file(s) |
| `LOCALE_LOADED` | yes | module:i18n | - | 1 file(s) | - |
| `LOCAL_DIRECTORY_LISTED` | yes | module:file-system | - | 1 file(s) | - |
| `LOCAL_DIRECTORY_PICKED` | yes | module:file-system | - | 1 file(s) | - |
| `LOCAL_FILE_ACCESS_ERROR` | yes | module:file-system | - | 1 file(s) | - |
| `LOCAL_FILE_PICKED` | yes | module:file-system | - | 1 file(s) | - |
| `LOCAL_FILE_READ` | yes | module:file-system | - | 1 file(s) | - |
| `LOCAL_FILE_WRITTEN` | yes | module:file-system | - | 1 file(s) | - |
| `LOCAL_PERMISSION_CHANGED` | yes | module:file-system | - | 1 file(s) | - |
| `LOCAL_SAVE_FILE_PICKED` | yes | module:file-system | - | 1 file(s) | - |
| `LOCATION_ERROR` | yes | module:location | - | 1 file(s) | - |
| `LOCATION_UPDATED` | yes | module:location | - | 1 file(s) | - |
| `LOG_ENTRY` | yes | runtime | - | 1 file(s) | 1 file(s) |
| `MEDIA_CAPTURE_COMPLETED` | yes | module:media | - | 1 file(s) | - |
| `MEDIA_CAPTURE_ERROR` | yes | module:media | - | 1 file(s) | - |
| `MEDIA_CAPTURE_STARTED` | yes | module:media | - | 1 file(s) | - |
| `MEDIA_CAPTURE_STOPPED` | yes | module:media | - | - | - |
| `MEDIA_OPTIMIZE_COMPLETED` | yes | module:media | - | 1 file(s) | - |
| `MEDIA_RESIZE_COMPLETED` | yes | module:media | - | 1 file(s) | - |
| `MEDIA_TRANSFORM_COMPLETED` | yes | module:media | - | 1 file(s) | - |
| `MEDIA_TRANSFORM_ERROR` | yes | module:media | - | - | - |
| `MENTION_AI_TASK_COMPLETED` | yes | module:mentions | 60/60000ms | 1 file(s) | 1 file(s) |
| `MENTION_DETECTED` | yes | module:mentions | 120/60000ms | 1 file(s) | 2 file(s) |
| `MODAL_ERROR` | yes | module:modal-system | - | 1 file(s) | - |
| `MODAL_STACK_UPDATED` | yes | module:modal-system | - | 1 file(s) | - |
| `MODULE_CONTRIBUTION_REGISTERED` | yes | runtime | - | 1 file(s) | - |
| `MODULE_CONTRIBUTION_UNREGISTERED` | yes | runtime | - | 1 file(s) | - |
| `MODULE_LOADED` | yes | runtime | - | 1 file(s) | 1 file(s) |
| `MODULE_UNLOADED` | yes | runtime | - | 1 file(s) | 1 file(s) |
| `NETWORK_STATUS_CHANGED` | yes | module:network-status | - | 1 file(s) | 2 file(s) |
| `NETWORK_STATUS_ERROR` | yes | module:network-status | - | 1 file(s) | - |
| `NOTIFICATIONS_CENTER_CLOSED` | yes | module:notifications | - | - | 1 file(s) |
| `NOTIFICATIONS_CENTER_OPENED` | yes | module:notifications | - | - | 1 file(s) |
| `NOTIFICATIONS_CLEARED` | yes | module:notifications | - | - | 1 file(s) |
| `NOTIFICATIONS_PERMISSION_CHANGED` | yes | module:notifications | - | 1 file(s) | - |
| `NOTIFICATIONS_PUSH_SUBSCRIBED` | yes | module:notifications | - | 1 file(s) | - |
| `NOTIFICATIONS_PUSH_UNSUBSCRIBED` | yes | module:notifications | - | 1 file(s) | - |
| `NOTIFICATIONS_READ_ALL` | yes | module:notifications | - | - | 1 file(s) |
| `NOTIFICATIONS_STATE_CHANGED` | yes | module:notifications | - | 1 file(s) | 2 file(s) |
| `NOTIFICATION_ENQUEUED` | yes | module:notifications | - | - | 1 file(s) |
| `NOTIFICATION_READ` | yes | module:notifications | - | - | 1 file(s) |
| `NOTIFICATION_REMOVED` | yes | module:notifications | - | - | 1 file(s) |
| `OPTIMISTIC_ACTION_ACKED` | yes | module:optimistic-sync | - | 1 file(s) | - |
| `OPTIMISTIC_ACTION_DROPPED` | yes | module:optimistic-sync | - | 1 file(s) | - |
| `OPTIMISTIC_ACTION_FAILED` | yes | module:optimistic-sync | - | 1 file(s) | - |
| `OPTIMISTIC_ACTION_INGESTED` | yes | module:optimistic-sync | - | 1 file(s) | 1 file(s) |
| `OPTIMISTIC_ACTION_RECORDED` | yes | module:optimistic-sync | - | 1 file(s) | 1 file(s) |
| `OPTIMISTIC_ACTION_UPDATED` | yes | module:optimistic-sync | - | 1 file(s) | - |
| `OPTIMISTIC_CRDT_STATE_CHANGED` | yes | module:optimistic-sync | - | 1 file(s) | - |
| `OPTIMISTIC_INVALIDATION` | yes | module:optimistic-sync | - | 1 file(s) | - |
| `OPTIMISTIC_SERVER_REWORK` | yes | module:optimistic-sync | - | 1 file(s) | 1 file(s) |
| `OPTIMISTIC_TRANSPORT_ACK` | yes | module:optimistic-sync | - | 1 file(s) | - |
| `OPTIMISTIC_TRANSPORT_REPLAY` | yes | module:optimistic-sync | - | 1 file(s) | 1 file(s) |
| `OPTIMISTIC_TRANSPORT_STATE` | yes | module:optimistic-sync | - | 1 file(s) | - |
| `PAGE_CHANGED` | yes | runtime | - | - | - |
| `PAGINATION_PAGE_CHANGED` | yes | runtime | - | - | - |
| `PAGINATION_SIZE_CHANGED` | yes | runtime | - | - | - |
| `PAYMENT_ADAPTER_READY` | yes | module:payment-adapters | 60/60000ms | 1 file(s) | - |
| `PAYMENT_FLOW_ERROR` | yes | module:payment-adapters | 60/60000ms | 1 file(s) | - |
| `PAYMENT_FLOW_STARTED` | yes | module:payment-adapters | 60/60000ms | 1 file(s) | - |
| `PERMISSIONS_UI_DENIED` | yes | module:permissions-ui | 60/60000ms | 1 file(s) | - |
| `PERMISSIONS_UI_ERROR` | yes | module:permissions-ui | 60/60000ms | - | - |
| `PERMISSIONS_UI_UPDATED` | yes | module:permissions-ui | 60/60000ms | 1 file(s) | - |
| `POPOVER_TOGGLED` | yes | runtime | - | - | - |
| `PRESENTER_SYNC` | yes | module:slides | - | 1 file(s) | 1 file(s) |
| `PROGRESS_COMPLETED` | yes | runtime | - | - | - |
| `PROGRESS_UPDATE` | yes | runtime | - | - | - |
| `PUBLIC_FORM_REJECTED` | yes | runtime | - | 1 file(s) | - |
| `PUBLIC_FORM_SIGNED` | yes | runtime | - | - | - |
| `REVIEWS_ERROR` | yes | module:reviews | 60/60000ms | - | - |
| `REVIEWS_UPDATED` | yes | module:reviews | 60/60000ms | 1 file(s) | - |
| `REVIEW_SUBMITTED` | yes | module:reviews | 60/60000ms | 1 file(s) | - |
| `ROUTE_BLOCKED` | yes | module:router | - | 1 file(s) | - |
| `ROUTE_CHANGED` | yes | module:router | - | - | - |
| `ROUTE_NAVIGATION_FAILED` | yes | module:router | - | 1 file(s) | - |
| `ROUTE_NAVIGATION_STARTED` | yes | module:router | - | 1 file(s) | - |
| `ROUTE_NOT_FOUND` | yes | module:router | - | 1 file(s) | - |
| `SEARCH_ERROR` | yes | module:search | - | 1 file(s) | - |
| `SEARCH_FACETS_UPDATED` | yes | module:search | - | 1 file(s) | - |
| `SEARCH_INDEX_BATCH_UPDATED` | yes | module:search | - | 1 file(s) | - |
| `SEARCH_INDEX_CLEARED` | yes | module:search | - | 1 file(s) | - |
| `SEARCH_INDEX_UPDATED` | yes | module:search | - | 1 file(s) | - |
| `SEARCH_PAGINATION_CHANGED` | yes | module:search | - | 1 file(s) | - |
| `SEARCH_QUERY_INITIATED` | yes | module:search | ?/?ms | - | 1 file(s) |
| `SEARCH_RESULTS_RETURNED` | yes | module:search | - | 1 file(s) | - |
| `SEARCH_SUGGESTIONS_READY` | yes | module:search | - | 1 file(s) | - |
| `SECURITY_VIOLATION` | yes | runtime | - | 1 file(s) | - |
| `SELECTION_CHANGED` | yes | module:file-explorer | - | 1 file(s) | - |
| `SELECT_ANNOTATION` | yes | module:visual-editor | - | 2 file(s) | 2 file(s) |
| `SESSION_EXPIRED` | yes | runtime | - | - | - |
| `SHARE_COMPLETED` | **NO** | - | - | 1 file(s) | - |
| `SHARE_FAILED` | **NO** | - | - | 1 file(s) | - |
| `SLIDER_STATE_CHANGED` | yes | runtime | - | - | - |
| `SLIDER_VALUE_UPDATED` | yes | runtime | - | - | - |
| `SLIDE_CHANGED` | yes | module:slides | - | 1 file(s) | 7 file(s) |
| `SLIDE_MEDIA_CHANGED` | yes | module:slides | - | 1 file(s) | 2 file(s) |
| `STORAGE_ADDED` | yes | module:storage | - | 1 file(s) | - |
| `STORAGE_CLEARED` | yes | module:storage | - | 1 file(s) | - |
| `STORAGE_DELETED` | yes | module:storage | - | 1 file(s) | - |
| `STORAGE_READY` | yes | module:storage | - | 1 file(s) | - |
| `STORAGE_UPDATED` | yes | module:storage | - | 1 file(s) | - |
| `SYNC_QUEUE_ENQUEUED` | yes | module:sync-queue | - | 1 file(s) | - |
| `SYNC_QUEUE_ERROR` | yes | module:sync-queue | - | 1 file(s) | - |
| `SYNC_QUEUE_FLUSHED` | yes | module:sync-queue | - | 1 file(s) | - |
| `TAB_SWITCHED` | yes | runtime | - | - | - |
| `TEXT_MAX` | yes | module:share | - | - | - |
| `THEME_CHANGED` | yes | runtime | - | - | - |
| `TITLE_MAX` | yes | module:share | - | - | - |
| `TOAST_DISMISSED` | yes | runtime | - | - | - |
| `TOAST_SHOWN` | yes | runtime | - | 1 file(s) | - |
| `TODO_STATE_CHANGED` | **NO** | - | - | 1 file(s) | 1 file(s) |
| `TOKEN_REFRESHED` | yes | runtime | - | - | - |
| `TOOLTIP_INITIALIZED` | yes | runtime | - | - | - |
| `UI_STATE_CHANGED` | yes | module:slides | - | 1 file(s) | 4 file(s) |
| `URL_MAX` | yes | module:share | - | - | - |
| `USER_LOGGED_IN` | yes | runtime | - | - | - |
| `USER_LOGGED_OUT` | yes | runtime | - | - | - |
| `USER_REGISTERED` | yes | runtime | - | - | - |
| `VIEWPORT_CHANGED` | yes | module:layout | - | - | - |
| `VIEW_RENDERED` | yes | runtime | - | 1 file(s) | - |
| `VIEW_RENDER_FAILED` | yes | runtime | - | 1 file(s) | - |
| `WEBMCP_TOOLS_REGISTERED` | yes | module:webmcp | - | 1 file(s) | - |
