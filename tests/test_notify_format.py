from app.notify.format import (
    BACKTEST_DISCLAIMER,
    SITE_URL,
    TWEET_LIMIT,
    format_backtest_tweet,
    format_telegram_message,
    format_tweet,
)


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


def test_tweet_uses_cashtags_for_discovery():
    """$SEMBOL formatı X'in cashtag arama sayfasında görünürlük sağlar."""
    tweet = format_tweet(_payloads(n_bist=2, n_sp=0))
    assert "$SYM0" in tweet
    assert "$SYM1" in tweet


def test_telegram_message_has_no_cashtags():
    """Cashtag yalnızca X'e özgü bir kavram; Telegram'da anlamsız olurdu."""
    msg = format_telegram_message(_payloads(n_bist=2, n_sp=0))
    assert "$SYM0" not in msg
    assert "SYM0" in msg


def test_tweet_includes_discovery_hashtag_when_it_fits():
    tweet = format_tweet(_payloads(n_bist=2, n_sp=1))
    assert "#Borsa" in tweet


def _backtest_payload(**overrides):
    base = {
        "generated_at": "2026-08-09T06:00:00+00:00",
        "caveats": ["Komisyon yok.", BACKTEST_DISCLAIMER],
        "markets": {
            "bist100": {
                "daily": {
                    "horizons_bars": [5, 20, 60],
                    "horizons": {
                        "5": {"avg_return": 0.01, "win_rate": 0.52},
                        "20": {"avg_return": 0.056, "win_rate": 0.59, "beat_benchmark_rate": 0.50},
                        "60": {"avg_return": 0.09, "win_rate": 0.55},
                    },
                }
            },
            "sp500": {
                "daily": {
                    "horizons_bars": [5, 20, 60],
                    "horizons": {
                        "20": {"avg_return": 0.031, "win_rate": 0.61, "beat_benchmark_rate": 0.44},
                    },
                }
            },
            # bilinçli olarak MARKET_LABELS'ta yok: format_backtest_tweet bunu
            # atlamalı, "COMMODITY: ..." gibi tuhaf bir satır üretmemeli.
            "commodity": {"daily": {"horizons_bars": [20], "horizons": {"20": {"avg_return": 0.02, "win_rate": 0.5}}}},
        },
    }
    base.update(overrides)
    return base


def test_backtest_tweet_reports_return_and_win_rate_for_both_markets():
    # İki market + tam disclaimer 270 karaktere sığmaz (ölçüldü); bu durumda
    # kompakt satıra (getiri + kazanma, "endeksi yendi" olmadan) düşülür —
    # kırpılmış/bozuk metin değil, bilinçli bir kademe.
    tweet = format_backtest_tweet(_backtest_payload())
    assert "BIST 100" in tweet
    assert "%59 kazanma" in tweet
    assert "S&P 500" in tweet
    assert "%61 kazanma" in tweet
    assert SITE_URL in tweet
    assert BACKTEST_DISCLAIMER in tweet
    assert len(tweet) <= TWEET_LIMIT


def test_backtest_tweet_shows_benchmark_beat_when_only_one_market_fits():
    # Tek market varken bütçe bol: "endeksi yendi" detayı da sığar.
    payload = _backtest_payload()
    del payload["markets"]["sp500"]
    tweet = format_backtest_tweet(payload)
    assert "endeksi %50 yendi" in tweet
    assert len(tweet) <= TWEET_LIMIT


def test_backtest_tweet_skips_markets_outside_known_labels():
    tweet = format_backtest_tweet(_backtest_payload())
    assert "COMMODITY" not in tweet.upper()


def test_backtest_tweet_picks_middle_horizon():
    # horizons_bars=[5,20,60] -> ortanca 20 (avg_return %5.6); 5'in (%1.0)
    # ve 60'ın (%9.0) rakamları satırda olmamalı.
    tweet = format_backtest_tweet(_backtest_payload())
    assert "+5.6" in tweet
    assert "+1.0" not in tweet
    assert "+9.0" not in tweet


def test_backtest_tweet_falls_back_to_own_disclaimer_without_caveats():
    payload = _backtest_payload(caveats=[])
    tweet = format_backtest_tweet(payload)
    assert BACKTEST_DISCLAIMER in tweet


def test_backtest_tweet_empty_when_no_usable_market_data():
    assert format_backtest_tweet({"markets": {}}) == ""
    assert format_backtest_tweet({"markets": {"bist100": {}}}) == ""
    assert format_backtest_tweet({}) == ""
