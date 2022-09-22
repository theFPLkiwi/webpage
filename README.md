# webpage
Kiwi data for website: https://thefplkiwi.github.io/webpage/

PLEASE NOTE that not all players are represented and some players are given ID 0. The missing players are deemed to have left the league so all minutes and points are 0, although in reality they still have an FPL ID and may be selectable in-game. The players with ID 0 are players who might get some minutes but are not in the actual game yet for whatever reason, whether they are back from loan, youth players, or recent transfers. They are given a price of £3.0 due to not being in the game yet. When using this data in a solver designed to work with fplreview data, it may be necessary to remove these 0 IDs and insert the missing IDs with all 0s.

HOW TO USE WITH SERTALP'S SOLVER

- Download the data from the website and save it in the data folder as "kiwi.csv"
- Open data/regular_settings.json file and add "datasource": "kiwi"
- Go to run folder and run > python solve_regular.py

If you also have fplreview data in the folder (named data/fplreview.csv) then you can take an average by using "datasource": "avg".
To use fplreview data only, either remove the "datasource" option altogether, or set it to "datasource": "review"
