import { useMemo, useState } from "react";
import { ArrowLeft, Check, Coins, Feather, Minus, Plus, Shield, ShoppingCart, Sparkles, Sword, Zap } from "lucide-react";
import marketHeader from "@/assets/market-shop-header.png.asset.json";
import blacksmithMarket from "@/assets/blacksmith-market.png.asset.json";
import { categories, categoryCopy, ingredients, products, type Product, type ShopCategory } from "@/lib/shop-data";

const formatCoins = (value: number) => new Intl.NumberFormat("en-US").format(value);

export function MarketShop() {
  const [category, setCategory] = useState<ShopCategory>("knives");
  const [coins, setCoins] = useState(12450);
  const [owned, setOwned] = useState(() => new Set(["basic-knife", "wood-board", "local"]));
  const [equipped, setEquipped] = useState<Record<string, string>>({ knives: "basic-knife", boards: "wood-board", suppliers: "local" });
  const [cart, setCart] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState("Welcome back, Chef. What can I get for you?");

  const cartCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  const cartTotal = ingredients.reduce((sum, item) => sum + item.price * (cart[item.id] ?? 0), 0);
  const visibleProducts = category === "ingredients" || category === "blacksmith" ? [] : products[category];

  function selectCategory(next: ShopCategory) {
    setCategory(next);
    setNotice(categoryCopy[next].description);
  }

  function buy(item: Product) {
    if (owned.has(item.id)) {
      setEquipped((current) => ({ ...current, [category]: item.id }));
      setNotice(`${item.name} is now equipped.`);
      return;
    }
    if (coins < item.price) {
      setNotice(`You need ${formatCoins(item.price - coins)} more coins for ${item.name}.`);
      return;
    }
    setCoins((value) => value - item.price);
    setOwned((current) => new Set(current).add(item.id));
    setEquipped((current) => ({ ...current, [category]: item.id }));
    setNotice(`${item.name} purchased and ready to use!`);
  }

  function changeQuantity(id: string, change: number) {
    setCart((current) => {
      const next = Math.max(0, (current[id] ?? 0) + change);
      const updated = { ...current, [id]: next };
      if (next === 0) delete updated[id];
      return updated;
    });
  }

  function checkout() {
    if (!cartCount) return setNotice("Your basket is waiting for something fresh.");
    if (cartTotal > coins) return setNotice(`You need ${formatCoins(cartTotal - coins)} more coins for this basket.`);
    setCoins((value) => value - cartTotal);
    setCart({});
    setNotice("Fresh ingredients delivered to your pantry!");
  }

  return (
    <main className="market-shell">
      <header className="market-hero" aria-label="Kitchen market">
        <img src={marketHeader.url} alt="A friendly merchant at a warm wooden kitchen market" />
        <button className="back-button" type="button" onClick={() => setNotice("Back action ready for your game router.")}>
          <ArrowLeft aria-hidden="true" /> <span>Back</span>
        </button>
        <div className="coin-purse" aria-label={`${formatCoins(coins)} coins`}>
          <span className="coin-icon"><Coins aria-hidden="true" /></span>
          <strong>{formatCoins(coins)}</strong>
          <button type="button" aria-label="Get more coins" onClick={() => setNotice("Connect this button to your game’s coin store.")}><Plus /></button>
        </div>
      </header>

      <section className="shop-frame">
        <nav className="category-tabs" aria-label="Shop categories">
          {categories.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} type="button" aria-current={category === item.id ? "page" : undefined} className={category === item.id ? "active" : ""} onClick={() => selectCategory(item.id)}>
                <Icon aria-hidden="true" /><span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="merchant-note" aria-live="polite"><Sparkles aria-hidden="true" /><span>{notice}</span></div>

        <section className="parchment-panel">
          <div className="section-heading">
            <div><p className="eyebrow">Curated for your kitchen</p><h1>{categoryCopy[category].title}</h1></div>
            <p>{categoryCopy[category].description}</p>
          </div>

          {category === "ingredients" ? (
            <IngredientMarket cart={cart} onChange={changeQuantity} />
          ) : category === "blacksmith" ? (
            <Blacksmith coins={coins} onUpgrade={(price, name) => {
              if (coins < price) return setNotice(`You need ${formatCoins(price - coins)} more coins for ${name}.`);
              setCoins((value) => value - price);
              setNotice(`${name} forged! Your Chef’s Knife is stronger.`);
            }} />
          ) : (
            <div className={`product-grid product-grid-${category}`}>
              {visibleProducts.map((item) => (
                <ProductCard key={item.id} item={item} isOwned={owned.has(item.id)} isEquipped={equipped[category] === item.id} actionLabel={category === "staff" ? "Hire" : category === "suppliers" ? "Sign contract" : category === "equipment" ? "Install" : "Buy"} onBuy={() => buy(item)} />
              ))}
            </div>
          )}
        </section>

        {category === "ingredients" && (
          <div className="basket-bar">
            <div><ShoppingCart aria-hidden="true" /><span><strong>{cartCount}</strong> items</span><span className="basket-total"><Coins aria-hidden="true" /> {formatCoins(cartTotal)}</span></div>
            <button type="button" onClick={checkout} disabled={!cartCount}><ShoppingCart aria-hidden="true" /> Purchase basket</button>
          </div>
        )}
      </section>
    </main>
  );
}

const forgeUpgrades = [
  { name: "Sharpness", detail: "Makes cutting easier and faster.", stat: "72 → 82", icon: Sword },
  { name: "Speed", detail: "Faster knife movement for quicker cuts.", stat: "65 → 75", icon: Zap },
  { name: "Lightweight", detail: "Reduces drag and fatigue.", stat: "80 → 90", icon: Feather },
  { name: "Durability", detail: "Knife stays effective longer.", stat: "91 → 100", icon: Shield },
];

function Blacksmith({ coins, onUpgrade }: { coins: number; onUpgrade: (price: number, name: string) => void }) {
  return (
    <div className="blacksmith-workshop">
      <figure className="blacksmith-scene">
        <img src={blacksmithMarket.url} alt="A cheerful blacksmith forging a chef's knife in his market workshop" />
      </figure>
      <div className="knife-summary">
        <div><span className="knife-mark"><Sword aria-hidden="true" /></span><div><h2>Chef’s Knife</h2><p>★ Level 3</p></div></div>
        <dl>
          <div><dt>Sharpness</dt><dd>72/100</dd></div>
          <div><dt>Speed</dt><dd>65/100</dd></div>
          <div><dt>Weight</dt><dd>80/100</dd></div>
          <div><dt>Durability</dt><dd>91/100</dd></div>
        </dl>
      </div>
      <div className="forge-grid">
        {forgeUpgrades.map(({ name, detail, stat, icon: Icon }) => (
          <article className="forge-card" key={name}>
            <div className="forge-card-title"><Icon aria-hidden="true" /><h2>{name}</h2></div>
            <p>{detail}</p><strong>Level 3 → 4</strong><output>{stat}</output>
            <div className="forge-price"><Coins aria-hidden="true" /> 2,500</div>
            <button type="button" onClick={() => onUpgrade(2500, name)} disabled={coins < 2500}><Sparkles aria-hidden="true" /> Upgrade</button>
          </article>
        ))}
      </div>
    </div>
  );
}

function ProductCard({ item, isOwned, isEquipped, actionLabel, onBuy }: { item: Product; isOwned: boolean; isEquipped: boolean; actionLabel: string; onBuy: () => void }) {
  const Icon = item.icon;
  return (
    <article className="product-card">
      <div className={`product-visual product-visual-${item.accent}`}><Icon aria-hidden="true" /></div>
      <div className="product-copy"><h2>{item.name}</h2><p>{item.description}</p></div>
      <dl>{item.stats.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <div className="price"><Coins aria-hidden="true" /> {item.price === 0 ? "Included" : formatCoins(item.price)}</div>
      <button type="button" className={isEquipped ? "equipped" : "purchase"} onClick={onBuy} disabled={isEquipped}>
        {isEquipped ? <><Check aria-hidden="true" /> Equipped</> : isOwned ? <><Check aria-hidden="true" /> Equip</> : <><ShoppingCart aria-hidden="true" /> {actionLabel}</>}
      </button>
    </article>
  );
}

function IngredientMarket({ cart, onChange }: { cart: Record<string, number>; onChange: (id: string, change: number) => void }) {
  return <div className="ingredient-grid">{ingredients.map((item) => {
    const Icon = item.icon;
    const quantity = cart[item.id] ?? 0;
    return <article className="ingredient-card" key={item.id}>
      <div className={`ingredient-icon product-visual-${item.accent}`}><Icon aria-hidden="true" /></div>
      <div><h2>{item.name}</h2><p>{item.description}</p></div>
      <div className="ingredient-price"><Coins aria-hidden="true" /> {formatCoins(item.price)}</div>
      <div className="stepper" aria-label={`${item.name} quantity`}>
        <button type="button" aria-label={`Remove one ${item.name}`} onClick={() => onChange(item.id, -1)} disabled={!quantity}><Minus /></button>
        <output>{quantity}</output>
        <button type="button" aria-label={`Add one ${item.name}`} onClick={() => onChange(item.id, 1)}><Plus /></button>
      </div>
    </article>;
  })}</div>;
}
