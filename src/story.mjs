/** Vale's brief, relay objective and extraction report for each campaign level. */
const chapters = [
  // White Horizon
  [
    {
      stakes: "Lantern is driving the last truck in the evacuation convoy. All Vale can hear through the snow is his call sign.",
      action: "Find their signal",
      success: "Lantern comes through at last. The trucks are together, but their driver has two roads on his map and no way to tell which one is open.",
    },
    {
      stakes: "Both roads look the same under the snow. The pass station recorded which one the plow took.",
      action: "Recover the convoy codes",
      success: "Vale reads the plow's route back to Lantern. He switches on his headlights. A gunship circles into their beam.",
    },
    {
      stakes: "The convoy has found the pass. The gunship over it is waiting for the trucks to leave the trees.",
      action: "Expose the air blockade",
      success: "The gunship falls silent. One by one the headlights climb out of the snow and into the ash blowing across the pass.",
    },
  ],
  // Cinderfall
  [
    {
      stakes: "Ash has blotted out the pass markers. Lantern has stopped the column where he last saw a beacon.",
      action: "Restore the pass beacon",
      success: "The beacon answers. Vale picks up a survey crew on the far side. They have a crossing wide enough for the trucks.",
    },
    {
      stakes: "The survey crew can see the crossing from their shelter. Their short-range set needs the mountain relay to reach Lantern.",
      action: "Relay the crossing coordinates",
      success: "Lantern repeats the coordinates correctly. Across the ravine, the crew reports a siege walker standing over the exit.",
    },
    {
      stakes: "The survey crew is waving the trucks forward. The walker has the exit covered from above.",
      action: "Locate the siege walker",
      success: "The last truck clears the crossing. On the road down to the dunes, Lantern reports that his fuel light just came on.",
    },
  ],
  // Dune Lifeline
  [
    {
      stakes: "Lantern is coasting down the dunes to save fuel. Vale remembers a pumping station somewhere along the old freight road.",
      action: "Locate the fuel depot",
      success: "A depot operator answers the relay. There is fuel in the tanks. He sends the convoy to the service gate.",
    },
    {
      stakes: "The depot operator has the gate code. Its little transmitter can reach Ghost's relay before it can reach the trucks.",
      action: "Pass on the gate code",
      success: "The gate rolls back and fueling begins. From the pump tower the operator spots a missile truck watching the exit road.",
    },
    {
      stakes: "The convoy has fuel again. Lantern is holding at the pumps until someone draws the missile truck away from the exit.",
      action: "Trace the missile truck",
      success: "The missile launchers go quiet. The operator watches the trucks turn off the hot freight road into jungle shade.",
    },
  ],
  // Canopy Hold
  [
    {
      stakes: "Lantern hears his own call sign answered twice. Someone under the canopy is listening to the convoy channel.",
      action: "Trace the listening post",
      success: "Vale catches the second transmission. The listening post is copying the convoy's calls and passing them to a command mech.",
    },
    {
      stakes: "The listening post knows the convoy's frequency. Vale has a spare channel for the drivers if Ghost can get it to them.",
      action: "Send the spare frequency",
      success: "The drivers check in on the spare channel. Their voices are clear. The mech is still guarding the road into town.",
    },
    {
      stakes: "The trucks can talk safely again. Vale needs the command mech's position before she can send them out of the trees.",
      action: "Pinpoint the command mech",
      success: "The mech goes down among the trees. Vale hears tires on pavement as the first truck enters the city.",
    },
  ],
  // Citadel Dawn
  [
    {
      stakes: "The city streets are barricaded. A dispatcher in the old tram office knows which blocks still connect.",
      action: "Reach the district dispatcher",
      success: "The dispatcher answers. She has marked a route along the tram tracks and needs a relay close enough to send it.",
    },
    {
      stakes: "Lantern can see the tram wires, but the tracks split at the next block. The dispatcher's map will get him through.",
      action: "Transmit the tram route",
      success: "The column follows the rails to the city gate. Through the dust, the dispatcher sees the beam of a laser tank cross the road.",
    },
    {
      stakes: "The tram route ends under a laser tank's sights. Ghost can use its command traffic to bring it into the open.",
      action: "Locate the armor blockade",
      success: "The tank's beam cuts out. Lantern clears the gate just as a tremor folds the highway ahead.",
    },
  ],
  // Faultline Zero
  [
    {
      stakes: "The highway ends at a fresh fault. A road crew left a working beacon on the far bank.",
      action: "Restore the fault beacon",
      success: "The beacon comes through between tremors. A road crew has found a service crossing farther upstream.",
    },
    {
      stakes: "The road crew can fit the trucks across one at a time. Vale needs their approach bearings before the dust rises again.",
      action: "Relay the crossing bearings",
      success: "Lantern lines the trucks up in single file. The crew spots missile tubes turning toward the far end of the crossing.",
    },
    {
      stakes: "A siege mech is covering the far bank. The road crew is ready to wave the trucks across as soon as its launchers fall silent.",
      action: "Locate the siege position",
      success: "The crew counts every truck across. Vale hands Lantern the frequency for a landing strip beyond the flooded lowlands.",
    },
  ],
  // Mire Crossing
  [
    {
      stakes: "Lantern is axle-deep in mud. He can see the landing lights across the water, but the airfield can't hear him.",
      action: "Find the landing channel",
      success: "Vale reaches the landing crew. They can hold the strip and need the convoy's arrival code to open the gate.",
    },
    {
      stakes: "The landing crew is waiting at the gate. Lantern's arrival code has to get through the jamming over the lowlands.",
      action: "Transmit the arrival code",
      success: "The gate opens. Above the approach, a command helicopter cuts across the landing lights. The crew holds the trucks back.",
    },
    {
      stakes: "The gate is open and the convoy is in sight. Ghost has one relay left to draw the command helicopter off the landing strip.",
      action: "Expose the final blockade",
      success: "The landing lights come back on. Lantern parks the last truck inside the gate and calls Vale one last time. She can hear every word.",
    },
  ],
];

export function missionStory(stage, level) {
  return chapters[stage][level];
}
