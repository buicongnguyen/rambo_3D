# Mobile movement joystick

Replaced the four direction buttons with the circular movement pad used by Tank_game_3D (src/three/input.ts). The 116px pad has a 46px thumb, a 15% radial dead zone and continuously scaled movement. Diagonal input is capped at full speed. Existing infantry and vehicle movement already preserve analog strength.

The initiating finger owns the pad until release, cancellation or lost capture. Firing, BLAST and action buttons use separate pointers. Pause, backgrounding and viewport changes reset input to prevent stuck movement. Keyboard controls remain available.

Validation: production TypeScript/Vite build; 40 unit checks; browser checks for analog strength, diagonal clamping, pointer ownership, cancellation, rotation and simultaneous movement/fire. Portrait and landscape captures are in joystick-portrait.png and joystick-landscape.png. CI runs the complete browser suite before publishing GitHub Pages.

## Mobile status layout correction

The joystick behavior alone did not match Tank's thumb placement: RAMBO's status windows still occupied the bottom corners. Touch controls now sit 20px from the bottom in portrait and 16px in landscape, plus the device safe-area inset. Portrait status panels sit above the action cluster. Landscape status panels fit between the joystick and combat buttons, stacking on narrow phones. Health, shield, awareness, ammunition and weapon names remain visible in compact panels. Desktop styling is unchanged.

Validated with collision/hit-target checks at 390x844, 320x568, 844x390, 568x320 and 1024x768, plus existing multitouch and analog-control regressions. Updated portrait and landscape captures show the arrangement.

## Essential mobile HUD

Mobile now hides the long radio panel, mission metadata, completed/future objectives, score, awareness tutorial, boss phase text and keyboard hints. The compact mission card shows only the stage name and first unfinished objective. Health/shield and weapon/ammunition remain visible; dodge cooldown or vehicle armor appears only when applicable. The minimap is 60px and boss health uses a compact strip. Mission and ordinary health panels are checked to remain below 65px high across five viewport sizes. Desktop information remains unchanged.
