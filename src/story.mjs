/** Radio fiction describes the relay operations the player actually performs. */
const chapters = [
  [
    "White Horizon",
    "Vale has lost the evacuation convoy in the blizzard.",
    [
      "Find their signal",
      "Recover the convoy codes",
      "Silence the air blockade",
    ],
    [
      "The radio is alive. Vale has the convoy frequency; recover its route codes next.",
      "The codes reveal a gunship blocking the pass. Take its command relay offline.",
      "The gunship is down. Vale guides the convoy toward the volcanic pass.",
    ],
  ],
  [
    "Cinderfall",
    "Ash has hidden the mountain crossing from the evacuation crews.",
    [
      "Restore the pass beacon",
      "Recover the safe crossing",
      "Break the mountain blockade",
    ],
    [
      "The beacon identifies a sheltered crossing. Its route is encrypted.",
      "Vale has the crossing coordinates. A walking siege platform guards the exit.",
      "The pass is open. The convoy needs a supply corridor across the dunes.",
    ],
  ],
  [
    "Dune Lifeline",
    "The convoy is running low on fuel in exposed desert country.",
    [
      "Locate the fuel corridor",
      "Recover the depot codes",
      "Stop the missile battery",
    ],
    [
      "The relay locates fuel depots beyond the dunes.",
      "The supply corridor is mapped. A mobile missile battery covers the departure road.",
      "The battery is silent. Vale moves the refueled convoy toward jungle shelter.",
    ],
  ],
  [
    "Canopy Hold",
    "Jungle patrols are listening for the convoy on an intercepted frequency.",
    [
      "Trace the listening post",
      "Recover a safe frequency",
      "Silence the command post",
    ],
    [
      "The listening network is exposed. Recover its switching codes.",
      "Vale changes the convoy frequency. The enemy command walker remains a threat.",
      "The command post is silent. The convoy can approach the city.",
    ],
  ],
  [
    "Citadel Dawn",
    "The last city corridor is boxed in by armored patrols.",
    [
      "Open the district channel",
      "Recover the street route",
      "Break the armor blockade",
    ],
    [
      "Vale reaches the district channel. Street coordinates are stored deeper inside.",
      "The route is clear on the map. Defeat the armor guarding its exit.",
      "The city blockade is broken. Tremors have closed the original evacuation road.",
    ],
  ],
  [
    "Faultline Zero",
    "Earthquakes have cut the main road; Vale needs an alternate crossing.",
    [
      "Restore the fault beacon",
      "Recover the alternate route",
      "Clear the siege position",
    ],
    [
      "The beacon reveals a surviving crossing.",
      "The alternate route is transmitted. A siege machine guards the far side.",
      "The crossing is open. Only the flooded lowlands remain.",
    ],
  ],
  [
    "Mire Crossing",
    "The convoy is close to safety, but its final landing channel is jammed.",
    [
      "Locate the landing channel",
      "Recover the extraction codes",
      "Silence the last jammer",
    ],
    [
      "Vale has the landing frequency. Recover the final authentication codes.",
      "The landing crew is ready. Destroy the command force holding the jammer.",
      "The channel is clear. Vale confirms the convoy is through. Everyone comes home.",
    ],
  ],
];
export function missionStory(stage, level) {
  const [, stakes, actions, outcomes] = chapters[stage];
  return { stakes, action: actions[level], success: outcomes[level] };
}
