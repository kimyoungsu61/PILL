package com.pill.account;

/** Transactional account mail only. Implementations must never log recipients or codes. */
public interface AccountMailSender {
    boolean available();
    void send(String recipient, String subject, String text, String idempotencyKey) throws Exception;
}
