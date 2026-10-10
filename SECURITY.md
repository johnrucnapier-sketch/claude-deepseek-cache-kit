# Privacy and security

Do not post API keys, authorization headers, raw requests, real conversations, private tool arguments, account identifiers, or infrastructure addresses in issues.

Reproduce problems with synthetic input. Include Node version, enabled rule names, expected/actual structural behavior, and test output you have checked. Rotate any credential accidentally exposed; deleting a public file does not revoke it or guarantee removal of copies.

The fingerprinter emits keyed hashes, lengths, message indexes and a fixed set of role labels. It never returns system tails, differing text windows, model names or tool names. HMAC keys default to random per-instance values and are not logged. Retaining or sharing a key reduces the protection against guessing; treat keys as secrets. Metadata can still reveal request size and repetition. Keep logs access-controlled and short-lived.

Normalization changes what the model sees. Hook context may carry security instructions; token counters may affect task planning. All rules are opt-in. Apply rules only to a reviewed client/provider route, then validate real behavior. Disabling the normalizer restores future forwarding behavior, but cannot recall requests already sent to a provider.

The original private diagnostic implementation printed text snippets despite a no-body comment. This project deliberately omits that behavior. No private production code, raw transcript archive, gateway credentials or internal Git history is bundled.
