# Relay houses and automatic securing

## Player-facing changes

Every relay has a small settlement: two barracks in the opening raid and three in each later mission. These supplement existing city buildings. Their amber entrance lamps, recessed open doors, window frames, steel canopy, roof coping and ventilation units are authored in Blender. The exported model is shared and batched with static terrain in both detail modes.

Walking or driving within three meters of the yellow relay automatically secures it once. A wall between the player and relay prevents activation. The objective checkmark, sound and radio confirm capture; the mobile objective card advances to the counterattack. E / USE continues to board and exit vehicles. Extraction still requires leaving the vehicle.

On nonfinale missions, the original number of response guards now arrives through house doorways. The first guard starts after a 0.8-second warning, followed by one guard every 0.85 seconds across available doors. Each walks out of the interior with articulated locomotion, then waits through the normal gun warning before firing. Normal, Hard and Crazy retain their existing response counts. Command bosses retain their existing finale arena arrivals.

## Logic and placement review

- House positions are deterministic and face toward the relay, with clear entrance-to-relay approaches.
- House footprints avoid all road branches with 3.8 meters of clearance. Start, extraction, boss formations and vehicle bays are protected.
- Existing explosive depots and fixed buildings are preserved. Only local replaceable cover is cleared for the new footprint and entrance lane; hazardous sand/mud patches cannot block the doorstep.
- A blocked entrance waits or uses another house. It never relocates a response soldier to an arbitrary open-ground position.
- Only an emerging soldier ignores its own house's solid footprint while following the short, straight doorway path. Other cover and vehicles still block it. Normal collision resumes outside the doorway.
- Pending guards count toward the extraction lock. Killing the first wave cannot open extraction while another response is waiting indoors.
- Restart clears the pending response and capture state. Paused/dead gameplay cannot trigger capture. Quakes suspend response deployment and doorway movement.
- Reinforcement placement runs at bounded intervals, not as a map scan every frame. The two or three static houses share one GLB (approximately 344 KiB) and add no real-time lights.

## Art reproduction

Run `.tools/blender-4.5.3-windows-x64/blender.exe --background --python-exit-code 1 --python art/build_relay_house.py`, or use a compatible installed Blender executable. The generator produces `public/models/relayHouse.glb` and editable `art/relay-house.blend`; it does not regenerate unrelated assets.

## Regression coverage

`tests/relay-houses.test.mjs` checks all 21 full layouts, doorway clearance, deterministic placement, road access, supply and vehicle availability, and the Blender export. `tests/relay-houses.spec.ts` checks automatic capture, all 12 Crazy response guards, doorway motion, wave timing, extraction gating, blocked-door recovery, restart, line-of-sight capture, vehicle capture and rendering. Existing touch, route, progression, boss and mobile layout checks cover integration. `docs/relay-houses.png` is captured from the actual game.
