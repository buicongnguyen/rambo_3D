# Snow border flicker

The pale border stripe was a 0.12m-high box embedded in a full 1.35m concrete wall, with exactly the same width and depth. Both materials occupied identical exterior side planes. A ray from inside the snow map reproduced two hits at distance 3.0m: pale stripe (#eef6f8) and concrete (#969c98). This is depth fighting and can appear as blinking while the camera moves.

The wall now has three adjoining vertical sections: concrete from 0 to 1.16m, the stripe from 1.16 to 1.28m, and a concrete cap to 1.35m. Exterior faces no longer overlap. Footings and seam posts remain. Collision boxes, wall height, material batching and graphics settings remain unchanged. The same shared construction fixes concrete stripes in other biomes too.

Validation: 72 ray checks (three snow levels, two quality settings, four edges, three heights) require a single face with the expected material. The existing perimeter movement, bullet blocking and indestructibility regression passes. A rendered snow-border screenshot is in snow-border-fixed.png. The production build passes; full CI gates deployment.
