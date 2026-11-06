# Intro Tour Requirements

## R1

| Property            | Value                                                        |
| ------------------- | ------------------------------------------------------------ |
| ID                  | R1                                                           |
| Interview evidence  | C-2/S-7/S-8: “Show it once.” / “If I close it, don’t show it |
|                     | again unless I ask for it.”                                  |
| Requirement         | The tour automatically opens on the first launch. Don’t show |
|                     | it again unless with `/intro`.                               |
| Acceptance criteria | On the first login, launching OpenCode shows the tour. The   |
|                     | user closes it at step 2, quits, and relaunches: no tour     |
|                     | appears. The user types `/intro`: the tour appears.          |

## R2

| Property            | Value                                                        |
| ------------------- | ------------------------------------------------------------ |
| ID                  | R2                                                           |
| Interview evidence  | C-2/C-4/O-4: “The next button should bring to the next step, |
|                     | and so should the enter keyword”                             |
| Requirement         | The tour advances on user input, such as enter, presses, and |
|                     | arrow keys.                                                  |
| Acceptance criteria | Enter, pressing the next button, and the right arrow key     |
|                     | should move to the next step in the intro.                   |

## R3

| Property            | Value                                                        |
| ------------------- | ------------------------------------------------------------ |
| ID                  | R3                                                           |
| Interview evidence  | C-1/O-2: “should always have spotlight for the relevant part |
|                     | being interacted with”                                       |
| Requirement         | Depending on the step of the tour, it highlights the         |
|                     | relevant components that the user should be interacting      |
|                     | with.                                                        |
| Acceptance criteria | On the “Switch model” step, the model selector is            |
|                     | highlighted and everything else is dimmed. After advancing   |
|                     | to the “Connect an MCP server” step, the highlight moves to  |
|                     | that control and the model selector is no longer             |
|                     | highlighted.                                                 |

## R4

| Property            | Value                                                        |
| ------------------- | ------------------------------------------------------------ |
| ID                  | R4                                                           |
| Interview evidence  | C-1/O-2: “Never should just bring them into a simulation     |
|                     | without a skip button”                                       |
| Requirement         | A skip button should be visible during the tour.             |
| Acceptance criteria | Each step should have a skip button.                         |

## Requirement Types

| ID  | Requirement                                        | Type           |
| --- | -------------------------------------------------- | -------------- |
| R1  | The tour automatically opens on the first launch.  | Invariant      |
|     | Don’t show it again unless with `/intro`.          |                |
| R2  | The tour advances on user input, such as enter,    | Model / oracle |
|     | presses, and arrow keys.                           |                |
| R3  | Depending on the step of the tour, it highlights   | Invariant      |
|     | the relevant components that the user should be    |                |
|     | interacting with.                                  |                |
| R4  | A skip button should be visible during the tour.   | Invariant      |
