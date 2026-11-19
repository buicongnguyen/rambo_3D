# Campaign story and mission logic

## Design goal

Give the player a reason to enter each fight, a visible next action during it, and news of what changed afterward. Both campaigns follow an evacuation convoy. The drivers speak over the radio, so the games can show the consequences of a mission without asking the player to escort a vehicle or babysit a health bar.

## Rambo 3D · Operation Nightfall

Ghost works the ground, Vale coordinates the radio, and Lantern drives the last truck. Each of the seven stages has three missions. The first establishes contact, the second transmits what the convoy needs, and the third draws out the command force blocking the next leg.

| Stage | What the convoy needs | What the player accomplishes |
| --- | --- | --- |
| White Horizon | A way out of the whiteout | Find Lantern’s signal, recover the plowed route and expose the gunship. |
| Cinderfall | A pass wide enough for the trucks | Restore the beacon, relay survey coordinates and locate the siege walker. |
| Dune Lifeline | Fuel for the last truck | Find the depot, transmit its gate code and expose the missile truck. |
| Canopy Hold | A channel the enemy cannot monitor | Trace the listening post, switch frequencies and pinpoint the command mech. |
| Citadel Dawn | A passage through the city | Reach the dispatcher, transmit the tram route and expose the armor blockade. |
| Faultline Zero | A crossing that survived the tremors | Restore the beacon, transmit bearings and locate the siege position. |
| Mire Crossing | Permission to enter the landing strip | Find the channel, transmit the arrival code and clear the final blockade. |

**Mission flow.** The player approaches the yellow relay to transmit. On a regular level, guards emerge from nearby houses. On a finale, the command units respond. Once that force is defeated, the player can leave on foot at green extraction while patrols are still active. Clearing the entire sector after the transmission brings Vale directly to the squad. This lets a player who wins the whole fight finish immediately while preserving the reason Ghost came.

**Optional rescue.** Give one star for completion, one for meeting par or freeing at least one prisoner during this mission, and one for finishing with at least half health. All require a win. An ally brought from a previous mission does not earn another rescue star. This gives the player a reason to stop at a blue door even late in the mission. Rescue and speed together still use a single star slot.

**Feedback and retries.** Use the selected mission’s briefing for both desktop recon and the phone Orders button. Show its outcome above the reward tally. Count actual rescues and returning allies separately from the convoy report. A relay retry restores the snapshot taken at transmission and replays the response. A full mission retry starts at insertion. Only a successful mission banks its rewards and advances the campaign.

## Rambo 2D · Operation Iron Vengeance

Mara is waiting with the first truck. An early victory gets it to the ferry, where the player learns that a whole line of drivers needs the bridge. That discovery sets up the rest of the campaign.

| Missions | Story progression |
| --- | --- |
| Emerald Killbox → River Run → Blacksite Siege | Reach the ferry, secure the bridge, then silence the hilltop post directing attacks. Its traffic log points inland. |
| Dust River Pass → Factory Underground → Zombie Catacombs | Open the pass, follow the armor tracks into the factory and trace the supply tunnel to the delta. |
| Delta Fever → Dust Mesa Rise → Burrow Foundry | Open the docks, move the convoy beyond the ridge, then defeat both foundry defenders. Mara counts the last truck through. |

**Mission flow.** Activate and clear the encounter zones, then enter the boss arena. If the player drives past a surviving enemy, point back to that patrol. If reinforcements are pending, signal that the wave is still underway. Once the zones clear, point to the arena. Each briefing names the bosses from the roster the game will spawn. Paired fights use one combined health bar until both bosses are down.

**Fair outcomes.** Place combatants with enough space for their actual collision bodies. Once the squad dies, a lingering attack cannot turn defeat into victory or add score during the defeat countdown. Retry restores that stage’s entry score. A completed stage awards its outcome once and introduces the next assignment.

## Verification plan

- Clear the 3D opening patrol before the relay. Check that the yellow objective stays active, nothing is banked, and the mission continues. Then transmit, defeat the response, and verify field pickup and a single reward. Test marked extraction separately with patrols alive.
- Finish under par, over par with a rescue, and over par without one. Check the star total at exactly half health and check that defeat banks nothing.
- Open orders on a phone, preview another stage, and read its dispatch after winning. Check that the debrief remains readable on a short screen and that the final report describes the convoy that actually arrived.
- Exercise all nine 2D stages. Check each wave and boss against cover, drive past a surviving patrol, clear a paired-boss fight, and test a squad death while damage is still being applied. Check both desktop and touch inputs when continuing or retrying.

## Playtest findings

| Scenario | Finding and result |
| --- | --- |
| Opening 3D patrol | The original build saved mission two while the relay was still untouched. The same playtest now stays on mission one with the relay as the next goal. Clearing the response still permits an immediate pickup. |
| 3D final evacuation | Two phone-sized sessions reached the marked exit with patrols alive. Both arrived 23 seconds over par. The run without a rescue banked 20 star credits. The rescue run banked 105 credits from three stars and one diamond. Reloading and replaying preserved the bank and squad. |
| 3D phone report | On a 320 × 568 viewport, focusing the action button previously scrolled the story above the screen. The mission report now opens with the outcome visible and the action reachable below. |
| 2D deployment clearance | In the nine-stage test layout, 111 of 312 enemy and boss bodies overlapped cover. The same check after the change found zero overlaps across 300 wave enemies and 12 bosses. |
| 2D delayed damage | A lingering poison effect could kill a boss and award 1,000 points after the player died. The same sequence now resolves as defeat with the pre-kill score. |
| 2D paired fights | Killing the first boss used to send the combined bar back to 100%. All three paired fights now keep their original total health as the denominator. |

The 2D campaign checks use controlled damage to exercise every encounter and result. The 3D tests include an Easy opening completed with simulated movement and normal weapon damage. Phone checks used touch emulation in Chromium.
