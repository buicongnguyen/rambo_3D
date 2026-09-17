# Mobile movement joystick

Replaced the four direction buttons with the circular movement pad used by Tank_game_3D (src/three/input.ts). The 116px pad has a 46px thumb, a 15% radial dead zone and continuously scaled movement. Diagonal input is capped at full speed. Existing infantry and vehicle movement already preserve analog strength.

The initiating finger owns the pad until release, cancellation or lost capture. Firing, BLAST and action buttons use separate pointers. Pause, backgrounding and viewport changes reset input to prevent stuck movement. Keyboard controls remain available.

Validation: production TypeScript/Vite build; 40 unit checks; browser checks for analog strength, diagonal clamping, pointer ownership, cancellation, rotation and simultaneous movement/fire. Portrait and landscape captures are in joystick-portrait.png and joystick-landscape.png. CI runs the complete browser suite before publishing GitHub Pages.
