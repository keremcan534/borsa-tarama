from app.notify.format import SITE_URL, TWEET_LIMIT, format_telegram_message, format_tweet


def _payloads(n_bist=3, n_sp=120):
    def market(n, suffix):
        return {
            "generated_at": "2026-07-14T09:49:06+00:00",
            "results": [{"symbol": f"SYM{i}{suffix}"} for i in range(n)],
        }

    return {"bist100": market(n_bist, ".IS"), "sp500": market(n_sp, "")}


def test_telegram_message_has_counts_link_and_disclaimer():
    msg = format_telegram_message(_payloads())
    assert "BIST 100" in msg and "S&P 500" in msg
    assert "<b>3</b> hisse" in msg and "<b>120</b> hisse" in msg
    assert SITE_URL in msg
    assert "Yatırım tavsiyesi değildir" in msg


def test_telegram_message_strips_is_suffix_and_truncates_list():
    msg = format_telegram_message(_payloads(n_bist=2))
    assert "SYM0, SYM1" in msg
    assert ".IS" not in msg
    assert "(+110)" in msg  # sp500: 120 sonuçtan 10'u listelenir


def test_telegram_scan_time_in_istanbul_timezone():
    msg = format_telegram_message(_payloads())
    assert "14.07.2026 12:49" in msg  # 09:49 UTC = 12:49 TR


def test_tweet_stays_under_limit_even_with_many_results():
    tweet = format_tweet(_payloads(n_bist=90, n_sp=500))
    assert len(tweet) <= TWEET_LIMIT
    assert SITE_URL in tweet


def test_telegram_message_highlights_new_signals():
    payloads = _payloads(n_bist=2)
    payloads["bist100"]["results"][0]["is_new"] = True
    msg = format_telegram_message(payloads)
    assert "🆕 Yeni sinyal: SYM0" in msg


def test_tweet_mentions_new_signal_count():
    payloads = _payloads(n_bist=2, n_sp=1)
    payloads["bist100"]["results"][0]["is_new"] = True
    payloads["sp500"]["results"][0]["is_new"] = True
    tweet = format_tweet(payloads)
    assert "🆕 2 yeni sinyal" in tweet


def test_tweet_handles_empty_results():
    payloads = {
        "bist100": {"generated_at": "2026-07-14T09:49:06+00:00", "results": []},
        "sp500": {"generated_at": "2026-07-14T09:49:06+00:00", "results": []},
    }
    tweet = format_tweet(payloads)
    assert "0 hisse" in tweet
    assert len(tweet) <= TWEET_LIMIT
