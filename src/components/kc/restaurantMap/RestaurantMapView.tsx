import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useUnlockText } from "../navLevel";
import { LandscapeBackdrop } from '@/components/kc/game/LandscapeBackdrop';
import {
  DEFAULT_RESTAURANT_NAME,
  RESTAURANT_NAME_MAX,
  cleanRestaurantName,
} from '@/game/restaurant/restaurantName';
import type {
  RestaurantMapProps,
  HotspotZoneConfig
} from './restaurantMap';
import {
  RESTAURANT_MAP_DISPLAY_ZONES,
  isZoneUnlocked,
  mapRoomOpen
} from './restaurantMapZones';
import './RestaurantMap.css';
import { GuestPoses } from './GuestPoses';
import { StaffLife } from './StaffLife';

export const RestaurantMap: React.FC<RestaurantMapProps> = ({
  playerLevel,
  currentScreen,
  onNavigateToScreen,
  onLockedZoneClick,
  kitchenMapImage,
  fridgeTier = 'basic',
  restaurantName: restaurantNameProp,
  onRestaurantNameChange,
  reducedMotion = false,
  staffOnMap,
  onCleanerDone,
  attentionCounts = {},
  attentionSymbols = {},
  mapWebpUrl,
  mapJpgUrl,
  className = ''
}) => {
  const u = useUnlockText();
  const [hoveredZone, setHoveredZone] = useState<HotspotZoneConfig | null>(null);
  const [lockedNotice, setLockedNotice] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [restaurantName, setRestaurantName] = useState(DEFAULT_RESTAURANT_NAME);
  const [restaurantNameDraft, setRestaurantNameDraft] = useState(DEFAULT_RESTAURANT_NAME);
  const [isEditingRestaurantName, setIsEditingRestaurantName] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const noticeTimerRef = useRef<number | null>(null);

  // The name lives in the save (restaurant/restaurantName.ts, developer 2026-10-17); it
  // used to be kept in plain localStorage here, outside SaveManager.
  useEffect(() => {
    setRestaurantName(restaurantNameProp || DEFAULT_RESTAURANT_NAME);
  }, [restaurantNameProp]);

  const startEditingRestaurantName = () => {
    setRestaurantNameDraft(restaurantName);
    setIsEditingRestaurantName(true);
  };

  const saveRestaurantName = () => {
    const nextName = cleanRestaurantName(restaurantNameDraft) || DEFAULT_RESTAURANT_NAME;
    setRestaurantName(nextName);
    setIsEditingRestaurantName(false);
    onRestaurantNameChange?.(nextName);
  };

  // Show a temporary locked toast
  const showLockedNotice = useCallback((text: string) => {
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
    }
    setLockedNotice(text);
    noticeTimerRef.current = window.setTimeout(() => {
      setLockedNotice(null);
    }, 2800);
  }, []);

  const handleZoneClick = useCallback((zone: HotspotZoneConfig) => {
    const unlocked = isZoneUnlocked(zone, playerLevel);
    if (!unlocked) {
      const msg = zone.unlockDescription || `${zone.name} unlocks ${u.when(zone.unlockLevel)}.`;
      showLockedNotice(msg);
      if (onLockedZoneClick) {
        onLockedZoneClick(zone);
      }
      return;
    }

    onNavigateToScreen(zone.targetScreen, zone.id);
  }, [playerLevel, showLockedNotice, onLockedZoneClick, onNavigateToScreen, u]);

  const handleKeyDown = (e: React.KeyboardEvent, zone: HotspotZoneConfig) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleZoneClick(zone);
    }
  };

  // Zoom controls
  const handleZoomIn = () => setZoomLevel((z) => Math.min(z + 0.3, 2.2));
  const handleZoomOut = () => {
    setZoomLevel((z) => {
      const next = Math.max(z - 0.3, 1.0);
      if (next === 1.0) setPanOffset({ x: 0, y: 0 });
      return next;
    });
  };
  const handleResetZoom = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Touch / mouse panning when zoomed
  const handlePointerDown = (e: React.PointerEvent) => {
    if (zoomLevel <= 1) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - panOffset.x,
      y: e.clientY - panOffset.y
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || zoomLevel <= 1) return;
    const maxPanX = 180 * (zoomLevel - 1);
    const maxPanY = 250 * (zoomLevel - 1);
    const newX = Math.max(Math.min(e.clientX - dragStartRef.current.x, maxPanX), -maxPanX);
    const newY = Math.max(Math.min(e.clientY - dragStartRef.current.y, maxPanY), -maxPanY);
    setPanOffset({ x: newX, y: newY });
  };

  const handlePointerUp = () => setIsDragging(false);

  return (
    <div
      className={`restaurant-map-container ${reducedMotion ? 'restaurant-map--reduced-motion' : ''} ${className}`}
      ref={containerRef}
      role="region"
      aria-label="KnifeCraft Restaurant Interactive Map"
    >
      {/* Phone landscape: the dining room painting around the map. */}
      <LandscapeBackdrop section="restaurant" wash="dim" />
      {/* Map Toolbar / View Controls */}
      <div className="restaurant-map-toolbar" role="toolbar" aria-label="Map View Controls">
        <div className="map-legend-pills">
          <span className="legend-pill level-pill">
            <span className="pill-dot" /> {u.noun} {playerLevel}
          </span>
          <span className="legend-pill hub-pill">Restaurant Hub</span>
        </div>

        <div className="map-zoom-controls">
          <button
            type="button"
            className="zoom-btn"
            onClick={handleZoomIn}
            aria-label="Zoom In Map"
            title="Zoom In"
          >
            +
          </button>
          <button
            type="button"
            className="zoom-btn"
            onClick={handleZoomOut}
            disabled={zoomLevel <= 1}
            aria-label="Zoom Out Map"
            title="Zoom Out"
          >
            −
          </button>
          {zoomLevel > 1 && (
            <button
              type="button"
              className="zoom-btn reset-btn"
              onClick={handleResetZoom}
              aria-label="Reset Map Zoom"
              title="Fit to Screen"
            >
              Fit
            </button>
          )}
        </div>
      </div>

      {/* Main Map Viewport */}
      <div
        className="restaurant-map-viewport"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          className="restaurant-map-stage"
          style={{
            transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`,
            cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
          }}
        >
          <picture className="restaurant-map-picture">
            {mapWebpUrl && <source type="image/webp" srcSet={mapWebpUrl} />}
            <img
              className="restaurant-vector-map"
              src={mapJpgUrl || kitchenMapImage || '/restaurant-map-generated-v3.png'}
              alt="Illustrated overhead floor plan of a warm, wood-framed restaurant, with labeled kitchen, dining, storage, service, and facility areas"
              draggable={false}
            />
          </picture>

          <FridgeMapOverlay tier={fridgeTier} />
          <AnimatedGuestTraffic />
          {staffOnMap ? <StaffLife hiredRoles={staffOnMap.roles} context={{ ...staffOnMap.context, diningOpen: staffOnMap.context.diningOpen && mapRoomOpen('dining', playerLevel), serviceOpen: staffOnMap.context.serviceOpen && mapRoomOpen('service', playerLevel) }} preview={staffOnMap.preview} onCleanerDone={onCleanerDone} /> : null}

          <div className="restaurant-nameboard-wrap">
            {isEditingRestaurantName ? (
              <form
                className="restaurant-nameboard is-editing"
                aria-label="Set restaurant name"
                onSubmit={(event) => { event.preventDefault(); saveRestaurantName(); }}
                onClick={(event) => event.stopPropagation()}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) saveRestaurantName();
                }}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <input
                  autoFocus
                  aria-label="Restaurant name"
                  maxLength={RESTAURANT_NAME_MAX}
                  value={restaurantNameDraft}
                  onChange={(event) => setRestaurantNameDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      setIsEditingRestaurantName(false);
                    }
                  }}
                />
              </form>
            ) : (
              <button
                type="button"
                className="restaurant-nameboard"
                aria-label={`Restaurant name: ${restaurantName}. Click to edit.`}
                title="Click to set your restaurant name"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => { event.stopPropagation(); startEditingRestaurantName(); }}
              >
                <svg className="nameboard-cutlery" viewBox="0 0 14 18" aria-hidden="true"><path d="M2 1v5M4 1v5M6 1v5M2 6v2c0 1.5 1 2.5 2 2.5V17M11 1c-1 3-2 5-2 7h2v9" /></svg>
                <span>{restaurantName}</span>
                <svg className="nameboard-cutlery" viewBox="0 0 14 18" aria-hidden="true"><path d="M2 1v5M4 1v5M6 1v5M2 6v2c0 1.5 1 2.5 2 2.5V17M11 1c-1 3-2 5-2 7h2v9" /></svg>
              </button>
            )}
          </div>

          {/* INTERACTIVE HOTSPOTS LAYER */}
          <div className="restaurant-map-hotspots-layer">
            {RESTAURANT_MAP_DISPLAY_ZONES.map((zone) => {
              const unlocked = isZoneUnlocked(zone, playerLevel);
              const isHovered = hoveredZone?.id === zone.id;
              const isCurrent = currentScreen === zone.targetScreen;

              return (
                <div
                  key={zone.id}
                  id={`hotspot-${zone.id}`}
                  tabIndex={0}
                  role="button"
                  aria-label={`${zone.name} (${zone.subName}) - ${unlocked ? 'Available' : `Locked (opens ${u.when(zone.unlockLevel)})`}`}
                  aria-disabled={!unlocked}
                  className={`map-hotspot-zone ${
                    unlocked ? 'is-unlocked' : 'is-locked'
                  } ${isHovered ? 'is-hovered' : ''} ${
                    isCurrent ? 'is-current-screen' : ''
                  }`}
                  style={{
                    left: `${zone.roomBounds.x}%`,
                    top: `${zone.roomBounds.y}%`,
                    width: `${zone.roomBounds.w}%`,
                    height: `${zone.roomBounds.h}%`
                  }}
                  onClick={() => handleZoneClick(zone)}
                  onKeyDown={(e) => handleKeyDown(e, zone)}
                  onMouseEnter={() => setHoveredZone(zone)}
                  onMouseLeave={() => setHoveredZone((curr) => (curr?.id === zone.id ? null : curr))}
                  onTouchStart={() => setHoveredZone(zone)}
                >
                  <div
                    className="hotspot-banner-anchor"
                    style={{
                      left: unlocked
                        ? `${((zone.bannerBounds.x + zone.bannerBounds.w / 2 - zone.roomBounds.x) / zone.roomBounds.w) * 100}%`
                        : '50%',
                      top: unlocked
                        ? `${((zone.bannerBounds.y + zone.bannerBounds.h / 2 - zone.roomBounds.y) / zone.roomBounds.h) * 100}%`
                        : '50%'
                    }}
                  >
                    {!unlocked && (
                      <div className="locked-pill-badge" title={zone.unlockDescription}>
                        <span className="lock-icon" aria-hidden="true">🔒</span>
                        <span className="lock-text">{u.lv(zone.unlockLevel)}</span>
                      </div>
                    )}
                    {unlocked && (attentionCounts[zone.id] ?? 0) > 0 && (
                      <span
                        className="map-attention-badge"
                        role="img"
                        aria-label={`${attentionCounts[zone.id]} attention ${
                          attentionCounts[zone.id] === 1 ? "item" : "items"
                        }; ${(attentionSymbols[zone.id] ?? ["⚠️"]).join(" ")}`}
                        title={`${attentionCounts[zone.id]} ${attentionCounts[zone.id] === 1 ? "item needs" : "items need"} attention`}
                      >
                        {(attentionSymbols[zone.id] ?? ["⚠️"]).map((symbol, index) => (
                          <span key={`${zone.id}-attention-${index}`} aria-hidden="true">{symbol}</span>
                        ))}
                        <i aria-hidden="true">!</i>
                      </span>
                    )}
                    {unlocked && (isHovered || isCurrent) && (
                      <div className="active-pill-badge">
                        <span className="pulse-dot" aria-hidden="true" />
                        <span className="badge-text">{zone.name}</span>
                      </div>
                    )}
                  </div>
                  <span className="hotspot-tap-ripple" aria-hidden="true" />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Floating Detail Card */}
      {hoveredZone && (
        <aside className="map-zone-detail-card" role="status" aria-live="polite">
          <div className="card-header">
            <span className="card-icon" aria-hidden="true">{hoveredZone.icon}</span>
            <div className="card-title-wrap">
              <strong className="card-title">{hoveredZone.name}</strong>
              <span className="card-subtitle">{hoveredZone.subName}</span>
            </div>
            {isZoneUnlocked(hoveredZone, playerLevel) ? (
              <span className="card-status-badge badge-ready">Open</span>
            ) : (
              <span className="card-status-badge badge-locked">
                {u.badge(hoveredZone.unlockLevel)}
              </span>
            )}
          </div>
          <p className="card-description">{hoveredZone.description}</p>
          <div className="card-footer">
            {isZoneUnlocked(hoveredZone, playerLevel) ? (
              <span className="card-action-hint">Tap to Enter Station ➔</span>
            ) : (
              <span className="card-locked-hint">
                {hoveredZone.unlockDescription || `Unlocks ${u.when(hoveredZone.unlockLevel)}`}
              </span>
            )}
          </div>
        </aside>
      )}

      {/* Locked Notification Toast */}
      {lockedNotice && (
        <div className="map-locked-toast" role="alert">
          <span className="toast-icon">🔒</span>
          <span className="toast-message">{lockedNotice}</span>
        </div>
      )}
    </div>
  );
};

export default RestaurantMap;

function AnimatedGuestTraffic() {
  return (
    <div className="restaurant-guest-layer" aria-hidden="true">
      <div className="map-guest-party map-guest-party--solo">
        <GuestPerson outfit="#bb633e" hair="#493324" order="Order" food="Food" />
      </div>
      <div className="map-guest-party map-guest-party--couple">
        <GuestPerson outfit="#4f7180" hair="#35271f" order="Order" food="Food" />
        <GuestPerson outfit="#9a5260" hair="#473222" />
      </div>
      <div className="map-guest-party map-guest-party--friends">
        <GuestPerson outfit="#547a55" hair="#35271f" order="Order" food="Food" />
        <GuestPerson outfit="#a16b3f" hair="#473222" />
        <GuestPerson outfit="#637da8" hair="#35271f" />
        <GuestPerson outfit="#9b667f" hair="#493324" />
      </div>
    </div>
  );
}
function GuestPerson({ outfit, hair, order, food, takeaway = false }: { outfit: string; hair: string; order?: string; food?: string; takeaway?: boolean }) {
  return (
    <div className="guest-person">
      <div className="guest-figure"><GuestPoses outfit={outfit} hair={hair} /></div>
      {order && <span className={`guest-action-bubble ${takeaway ? 'guest-takeaway-order' : 'guest-order-bubble'}`}>{order}</span>}
      {food && <span className={`guest-action-bubble ${takeaway ? 'guest-pickup-bubble' : 'guest-food-bubble'}`}>{food}</span>}
    </div>
  );
}

const FRIDGE_SHAPES = {
  basic: { width: 92, doors: 1, compartments: 1, finish: 'enamel' as const },
  commercial: { width: 184, doors: 2, compartments: 2, finish: 'painted' as const },
  professional: { width: 258, doors: 2, compartments: 3, finish: 'steel' as const }
} as const;

function FridgeMapOverlay({ tier }: { tier: 'basic' | 'commercial' | 'professional' }) {
  const spec = FRIDGE_SHAPES[tier];
  const left = (300 - spec.width) / 2;
  const doorWidth = (spec.width - 12) / spec.doors;
  const steel = spec.finish === 'steel';
  const bodyTop = 22;
  const bodyBottom = 139;
  const foodColors = ['#dc4b3f', '#82aa4a', '#f2b841', '#e9e5d9', '#5c91b5', '#d88b46'];
  const foodShape = (x: number, y: number, index: number, width: number) => {
    const color = foodColors[index % foodColors.length];
    const itemWidth = Math.min(width * 0.23, 13);
    return index % 3 === 0
      ? <g key={`food-${x}-${y}-${index}`}><rect x={x} y={y} width={itemWidth} height="9" rx="2" fill={color} stroke="#58666a" strokeWidth=".7" /><path d={`M${x + 2} ${y + 2}H${x + itemWidth - 2}`} stroke="#fff" strokeWidth=".8" opacity=".7" /></g>
      : index % 3 === 1
        ? <g key={`food-${x}-${y}-${index}`}><ellipse cx={x + itemWidth / 2} cy={y + 5} rx={itemWidth / 2} ry="4.5" fill={color} stroke="#58666a" strokeWidth=".7" /><ellipse cx={x + itemWidth / 2} cy={y + 5} rx={itemWidth / 2 - 2} ry="2" fill="#fff" opacity=".2" /></g>
        : <g key={`food-${x}-${y}-${index}`}><path d={`M${x} ${y + 8}Q${x + itemWidth / 2} ${y - 1} ${x + itemWidth} ${y + 8}Z`} fill={color} stroke="#58666a" strokeWidth=".7" /><path d={`M${x + itemWidth / 2} ${y + 2}V${y + 7}`} stroke="#fff" strokeWidth=".7" opacity=".7" /></g>;
  };

  const renderDoor = (doorIndex: number) => {
    const x = left + 6 + doorIndex * doorWidth;
    const y = bodyTop + 13;
    const width = doorWidth - 6;
    const height = bodyBottom - y - 5;
    const handleOnRight = doorIndex === 0 && spec.doors > 1;
    const handleX = handleOnRight ? x + width - 5 : x + 4;
    const glassX = x + 5;
    const glassWidth = width - 14;
    const isSplitProfessional = tier === 'professional' && doorIndex === 1;
    const splitY = y + height * 0.59;
    const sections = isSplitProfessional
      ? [{ top: y + 7, bottom: splitY - 4 }, { top: splitY + 5, bottom: y + height - 6 }]
      : [{ top: y + 7, bottom: y + height - 6 }];

    return (
      <g key={`door-${doorIndex}`}>
        {/* Door slab, inset gasket and insulated glass */}
        <rect x={x} y={y} width={width} height={height} rx="3" fill={steel ? 'url(#fridge-steel-door)' : 'url(#fridge-enamel-door)'} stroke={steel ? '#53636a' : '#77858a'} strokeWidth="1.8" />
        <rect x={x + 2} y={y + 2} width={width - 4} height={height - 4} rx="2" fill="none" stroke={steel ? '#f4f6f4' : '#f4f5ed'} strokeWidth="1" opacity=".8" />
        {sections.map((section, sectionIndex) => {
          const sectionHeight = section.bottom - section.top;
          const contentLeft = glassX + 2;
          const contentWidth = glassWidth - 4;
          const rowCount = tier === 'basic' ? 3 : 2;
          return (
            <g key={`section-${sectionIndex}`}>
              <rect x={glassX} y={section.top} width={glassWidth} height={sectionHeight} rx="2" fill="url(#fridge-glass)" stroke="#6b858b" strokeWidth="1" />
              <rect x={glassX + 2} y={section.top + 2} width={glassWidth - 4} height={sectionHeight - 4} fill="#d9edf0" opacity=".2" />
              {[...Array(rowCount)].map((_, shelfIndex) => {
                const shelfY = section.top + sectionHeight * ((shelfIndex + 1) / (rowCount + 1));
                const items = [0, 1, 2].map((itemIndex) => {
                  const itemX = contentLeft + 3 + itemIndex * Math.max(5, (contentWidth - 12) / 3);
                  const itemY = shelfY - 11;
                  return foodShape(itemX, itemY, doorIndex * 13 + sectionIndex * 7 + shelfIndex * 3 + itemIndex, contentWidth / 3);
                });
                return <g key={`shelf-${shelfIndex}`}>
                  {items}
                  <path d={`M${glassX + 2} ${shelfY}H${glassX + glassWidth - 2}`} stroke="#d8e1df" strokeWidth="2" />
                  <path d={`M${glassX + 3} ${shelfY + 1}H${glassX + glassWidth - 3}`} stroke="#708187" strokeWidth=".7" opacity=".7" />
                </g>;
              })}
              <path d={`M${glassX + 3} ${section.top + 4}V${section.bottom - 4}`} stroke="#fff" strokeWidth="1.5" opacity=".4" />
            </g>
          );
        })}
        {isSplitProfessional && <g>
          <rect x={x + 1} y={splitY - 3} width={width - 2} height="7" fill="url(#fridge-steel-door)" stroke="#53636a" strokeWidth="1" />
          <path d={`M${x + 5} ${splitY}H${x + width - 8}`} stroke="#45565d" strokeWidth="1.5" />
        </g>}
        <rect x={handleX} y={y + height * .3} width="3.5" height={height * .38} rx="1.7" fill="url(#fridge-handle)" stroke="#536168" strokeWidth=".7" />
        <path d={`M${handleX + 1} ${y + height * .32}V${y + height * .64}`} stroke="#fff" strokeWidth=".6" opacity=".8" />
        <circle cx={handleOnRight ? x + 2 : x + width - 2} cy={y + 8} r="1.3" fill="#596a70" />
        <circle cx={handleOnRight ? x + 2 : x + width - 2} cy={y + height - 8} r="1.3" fill="#596a70" />
      </g>
    );
  };

  return (
    <div className="fridge-map-overlay" aria-hidden="true">
      <svg viewBox="0 0 300 160" preserveAspectRatio="none">
        <defs>
          <linearGradient id="fridge-cabinet" x1="0" x2="1"><stop offset="0" stopColor={steel ? '#68777d' : '#a8b4b7'} /><stop offset=".12" stopColor={steel ? '#eef2ef' : '#fffdf4'} /><stop offset=".82" stopColor={steel ? '#bec8c8' : '#eee9d8'} /><stop offset="1" stopColor={steel ? '#65747a' : '#a8ada6'} /></linearGradient>
          <linearGradient id="fridge-steel-door" x1="0" x2="1"><stop offset="0" stopColor="#78868b" /><stop offset=".18" stopColor="#e8edeb" /><stop offset=".52" stopColor="#aebabc" /><stop offset=".82" stopColor="#f2f4f1" /><stop offset="1" stopColor="#79878b" /></linearGradient>
          <linearGradient id="fridge-enamel-door" x1="0" x2="1"><stop offset="0" stopColor="#d8d4c6" /><stop offset=".16" stopColor="#fffef5" /><stop offset=".72" stopColor="#f0edde" /><stop offset="1" stopColor="#c4c3b8" /></linearGradient>
          <linearGradient id="fridge-glass" x1="0" x2="1"><stop offset="0" stopColor="#78969e" stopOpacity=".86" /><stop offset=".13" stopColor="#d2e6e7" stopOpacity=".92" /><stop offset=".82" stopColor="#bed7da" stopOpacity=".88" /><stop offset="1" stopColor="#6f8a91" stopOpacity=".92" /></linearGradient>
          <linearGradient id="fridge-handle" x1="0" x2="1"><stop offset="0" stopColor="#59686d" /><stop offset=".45" stopColor="#f5f6ef" /><stop offset="1" stopColor="#748187" /></linearGradient>
          <linearGradient id="fridge-floor" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#b7c2c5" /><stop offset="1" stopColor="#75868b" /></linearGradient>
          <filter id="fridge-shadow" x="-30%" y="-20%" width="160%" height="160%"><feGaussianBlur stdDeviation="3" /></filter>
        </defs>
        {/* Cool room wall and floor remain visible around the appliance */}
        <rect width="300" height="160" fill="#91a0a2" />
        {[...Array(8)].map((_, i) => <path key={`wall-${i}`} d={`M${i * 42} 0V${bodyBottom}`} stroke="#dce4e2" strokeWidth="1.5" opacity=".55" />)}
        {[...Array(5)].map((_, i) => <path key={`wall-joint-${i}`} d={`M0 ${24 + i * 28}H300`} stroke="#d5dddb" strokeWidth="1" opacity=".38" />)}
        <rect x="0" y="145" width="300" height="15" fill="url(#fridge-floor)" />
        <path d="M0 148H300M0 155H300" stroke="#52646a" strokeWidth="2" opacity=".8" />
        <rect x={left + 2} y="25" width={spec.width} height="119" rx="5" fill="#1c2b30" opacity=".34" filter="url(#fridge-shadow)" />
        {/* Outer cabinet, insulated edge and lower kickplate */}
        <rect x={left} y="12" width={spec.width} height="129" rx="5" fill="url(#fridge-cabinet)" stroke="#34464c" strokeWidth="2.5" />
        <rect x={left + 3} y="15" width={spec.width - 6} height="7" rx="2" fill={steel ? 'url(#fridge-steel-door)' : '#d6d4c8'} stroke="#68777b" strokeWidth="1" />
        <rect x={left + 5} y="24" width={spec.width - 10} height="4" rx="1" fill="#4f6065" opacity=".9" />
        {[...Array(tier === 'basic' ? 5 : 11)].map((_, i) => <path key={`vent-${i}`} d={`M${left + 8 + i * ((spec.width - 16) / (tier === 'basic' ? 5 : 11))} 16V21`} stroke="#536268" strokeWidth="1.2" opacity=".9" />)}
        <rect x={left + 5} y="133" width={spec.width - 10} height="6" rx="1" fill={steel ? '#64757b' : '#c6c7bc'} stroke="#596970" strokeWidth=".8" />
        <path d={`M${left + 8} 135H${left + spec.width - 8}`} stroke="#e6e8e3" strokeWidth=".8" opacity=".7" />
        {[...Array(spec.doors + 1)].map((_, i) => <g key={`foot-${i}`}><path d={`M${left + 12 + i * ((spec.width - 24) / spec.doors)} 140V145`} stroke="#46575c" strokeWidth="2" /><ellipse cx={left + 12 + i * ((spec.width - 24) / spec.doors)} cy="145" rx="4" ry="1.5" fill="#334348" /></g>)}
        {tier === 'basic' && <g>
          <rect x={left + spec.width - 15} y="31" width="6" height="7" rx="1" fill="#4e5960" />
          <circle cx={left + spec.width - 12} cy="34.5" r="1" fill="#7fcb75" />
          <rect x={left + 7} y="25" width={spec.width - 14} height="2" fill="#fff" opacity=".7" />
        </g>}
        {tier === 'commercial' && <rect x={left + spec.width / 2 - 1.5} y="24" width="3" height="109" fill="#586970" opacity=".8" />}
        {[...Array(spec.doors)].map((_, i) => renderDoor(i))}
        {tier === 'professional' && <g>
          {/* Commercial refrigeration badge and temperature readout */}
          <rect x={left + spec.width / 2 - 20} y="15" width="40" height="6" rx="2" fill="#293b42" />
          <rect x={left + spec.width / 2 - 8} y="16.2" width="16" height="3.5" rx="1" fill="#a8dce2" />
          <circle cx={left + spec.width / 2 + 13} cy="18" r="1.3" fill="#70c68c" />
        </g>}
      </svg>
    </div>
  );
}
