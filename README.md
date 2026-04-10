# software-project-planner

Monte Carlo simulation over project work items to project probability of completion compared to available capacity in software teams.

Future improvements
- Handle orphan epics (i.e. epics that have an empty parent initiative field)
- Handle epics showing up in initiative CSV file.
- Handle when epics are assigned to different quarters but are all belonging to an initiative: what quarter should the epics be used to model then? Should it be split into separate intiatives by the model, one per each quarter that it has epics, as a way to model that some initiatives can span multiple quarters. What are the other options?
- Improve the "Team Level" tab (not very useful right now)
- Use the KR (key result) field in the simulation, e.g. break down charts per key result, or have an option to allocate percentages of capacity to different KRs)
- Add the notion of team dependencies: for now the initiatives are sampled via number of initiatives and then sizes of epics, and that’s it. It could evolve in a way that an initiative in a team could generate epics in another team based on historical data.

When future quarter data will be known beyond Q1:
- Re-run the adjustments to the lognormal distributions based on all known "realized effort" for more accuracy.
