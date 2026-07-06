# Coinugget Crypto Signals — MCP Server

Real-time cryptocurrency market signals via [Model Context Protocol (MCP)](https://modelcontextprotocol.io).

Tracks 500+ coins across Binance, Bybit, and Gate.io — RSI signals, top gainers, price action, kimchi premium, major market prices, and derivatives data. Updated every 60 seconds.

## Endpoint

```
https://mcp.coinugget.com/mcp
```

No authentication required. Free and publicly accessible.

## Tools (7)

| Tool | Description |
|------|-------------|
| `get_rsi` | RSI overbought (>70) and oversold (<30) top 10 coins |
| `get_gainers` | 24h top 10 gaining cryptocurrencies |
| `get_price_action` | Short-term price surges and drops top 10 |
| `get_kimchi` | Korean kimchi premium + 10-country regional premiums |
| `get_markets` | BTC, ETH, NASDAQ, GOLD, VIX and more with 24h changes |
| `get_derivatives` | 24h liquidation summary + long/short ratios |
| `get_full_snapshot` | Complete market snapshot (all data combined) |

## Connect

### Claude Code
```bash
claude mcp add coinugget-crypto-signals --transport http https://mcp.coinugget.com/mcp
```

### Claude Desktop
Settings → MCP Servers → Add → URL: `https://mcp.coinugget.com/mcp`

## Source

[coinugget.com](https://coinugget.com)

## License

MIT
