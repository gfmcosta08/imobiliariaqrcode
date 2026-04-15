create unique index if not exists idx_whatsapp_messages_provider_msg_unique
  on public.whatsapp_messages (provider, provider_message_id)
  where provider_message_id is not null;

create index if not exists idx_conversation_sessions_phone_state
  on public.conversation_sessions (lead_phone, state, updated_at desc);
