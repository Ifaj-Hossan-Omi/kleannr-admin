import { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import 'leaflet-draw';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import s from './ServiceAreasPage.module.css';

const DHAKA: L.LatLngTuple = [23.79, 90.4];
// leaflet-draw augments the leaflet runtime; reach it untyped to avoid plugin typings.
const DrawNS = (L as unknown as { Draw: { Polygon: new (map: L.Map, opts: unknown) => { enable: () => void; disable: () => void } } }).Draw;

/**
 * Draw-only map for creating a new service area. The API never returns saved polygons,
 * so this only captures a freshly drawn boundary. Remount (via a changing `key`) to redraw.
 */
export function AreaMap({ onPolygonDrawn }: { onPolygonDrawn: (ring: [number, number][]) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const groupRef = useRef<L.LayerGroup | null>(null);
  const drawerRef = useRef<{ disable: () => void } | null>(null);
  const onDrawnRef = useRef(onPolygonDrawn);
  onDrawnRef.current = onPolygonDrawn;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current).setView(DHAKA, 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
    groupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    map.on('draw:created', (e: { layer: L.Polygon }) => {
      const latlngs = e.layer.getLatLngs()[0] as L.LatLng[];
      // Leaflet gives {lat, lng}; the API wants GeoJSON [lng, lat].
      const ring = latlngs.map((p) => [p.lng, p.lat] as [number, number]);
      ring.push(ring[0]); // close the ring (first === last)
      groupRef.current?.clearLayers();
      e.layer.addTo(groupRef.current!);
      drawerRef.current?.disable();
      onDrawnRef.current(ring);
    });

    const drawer = new DrawNS.Polygon(map, {
      allowIntersection: false,
      shapeOptions: { color: '#126684', fillColor: '#45b2da', fillOpacity: 0.3, weight: 3 },
    });
    drawer.enable();
    drawerRef.current = drawer;

    setTimeout(() => map.invalidateSize(), 120);
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className={s.map} />;
}
