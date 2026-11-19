/**
 * The service floor (ServiceFloor, DiningCashView) is a crop of the restaurant painting with the same shape as a phone. In a wide window the crop is a
 * column in the middle, and the window must still be filled (developer 2026-11-19, Playgama 1.6.1 / 1.6.8, YouTube Playables Design 1: no empty bars, no
 * blurred side areas). So the painting goes on to the sides: copies of the same crop side by side, every other one mirrored, so each seam is the
 * same picture reflected: the dining room simply continues. It shows only when the stage is wider than the crop (serviceFloor.css); a tall narrow
 * stage keeps its blurred top and bottom, which are not side areas.
 */
export function FloorSides({ mapUrl }: { mapUrl: string }) {
  return (
    <div className="sf-sides" aria-hidden="true">
      {[-3, -2, -1, 0, 1, 2, 3].map((i) => (
        <div key={i} className={Math.abs(i) % 2 === 1 ? "sf-tile sf-tile--flip" : "sf-tile"}>
          <img className="sf-map" src={mapUrl} alt="" draggable={false} />
        </div>
      ))}
    </div>
  );
}
