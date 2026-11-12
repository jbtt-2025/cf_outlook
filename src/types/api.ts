// 1. Token 刷新契约
export interface RefreshTokenRequest {
  refresh_token: string;
  client_id?: string;
}

export interface RefreshTokenResponse {
  success: boolean;
  access_token?: string;
  expires_in?: number;
  new_refresh_token?: string;
  client_id?: string;
  error?: string;
  is_dead?: boolean;
}

// 2. 邮件拉取契约
export interface MailListRequest {
  access_token?: string;
  refresh_token?: string;
  client_id?: string;
  top?: number;
  include_junk?: boolean;
}

export interface MailRecipient {
  emailAddress?: {
    name?: string;
    address?: string;
  };
}

export interface GraphMessageItem {
  id: string;
  subject?: string;
  receivedDateTime?: string;
  from?: MailRecipient;
  bodyPreview?: string;
  body?: {
    contentType?: string;
    content?: string;
  };
  toRecipients?: MailRecipient[];
  ccRecipients?: MailRecipient[];
  internetMessageHeaders?: Array<{ name: string; value: string }>;
  __is_junk?: boolean;
}

export interface MailListResponse {
  success: boolean;
  messages?: GraphMessageItem[];
  new_refresh_token?: string;
  client_id?: string;
  error?: string;
}
