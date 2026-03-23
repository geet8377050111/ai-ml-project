import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect } from 'react';

// Fix for default marker icons in Leaflet with React using CDN
const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom icons for user and providers
const userIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `
    <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
      <div style="width: 24px; height: 24px; background-color: #ef4444; border-radius: 50%; border: 2px solid white; box-shadow: 0 4px 10px rgba(239, 68, 68, 0.4); z-index: 10; display: flex; align-items: center; justify-content: center; color: white;">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
      </div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const providerIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `
    <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
      <div style="width: 20px; height: 20px; background-color: #3b82f6; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 6px rgba(59, 130, 246, 0.3); z-index: 10; display: flex; align-items: center; justify-content: center; color: white;">
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
      </div>
    </div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

const liveProviderIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `
    <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
      <div class="animate-pulse-blue" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: #3b82f6; border-radius: 50%; opacity: 0.3;"></div>
      <div style="position: absolute; top: 4px; left: 4px; width: 24px; height: 24px; background-color: #3b82f6; border-radius: 50%; border: 2px solid white; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.5); z-index: 10; display: flex; align-items: center; justify-content: center; color: white;">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
      </div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

interface Provider {
  id: string;
  name: string;
  category: string;
  location?: { lat: number; lng: number };
  pricePerHour: number;
}

interface UserLocation {
  lat: number;
  lng: number;
  address?: string;
}

interface LiveProvider {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

// Component to handle map centering
function ChangeView({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export default function MapComponent({ 
  providers, 
  userLocation,
  liveProvider
}: { 
  providers: Provider[], 
  userLocation?: UserLocation,
  liveProvider?: LiveProvider
}) {
  const center: [number, number] = liveProvider 
    ? [liveProvider.lat, liveProvider.lng]
    : userLocation 
      ? [userLocation.lat, userLocation.lng] 
      : [28.6139, 77.2090]; // Default to Delhi

  return (
    <div className="h-[400px] w-full rounded-xl overflow-hidden shadow-lg border border-slate-200 z-0">
      <MapContainer 
        center={center} 
        zoom={14} 
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <ChangeView center={center} zoom={14} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
            <Popup>
              <div className="p-1">
                <p className="font-bold text-slate-900">Your Location</p>
                {userLocation.address && <p className="text-xs text-slate-500">{userLocation.address}</p>}
              </div>
            </Popup>
          </Marker>
        )}

        {liveProvider && (
          <Marker position={[liveProvider.lat, liveProvider.lng]} icon={liveProviderIcon}>
            <Popup>
              <div className="p-2 min-w-[150px]">
                <h3 className="font-bold text-slate-900">{liveProvider.name} (Live)</h3>
                <p className="text-xs text-blue-600 font-bold">On the way to your location</p>
              </div>
            </Popup>
          </Marker>
        )}

        {providers.map((p) => p.location && (
          <Marker 
            key={p.id} 
            position={[p.location.lat, p.location.lng]} 
            icon={providerIcon}
          >
            <Popup>
              <div className="p-2 min-w-[150px]">
                <h3 className="font-bold text-slate-900">{p.name}</h3>
                <p className="text-xs text-slate-500">{p.category}</p>
                <p className="text-sm font-semibold text-blue-600 mt-1">₹{p.pricePerHour}/hr</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
