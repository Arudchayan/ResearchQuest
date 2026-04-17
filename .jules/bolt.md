## 2024-05-24 - O(N) to O(1) Gamification Math Calculation
**Learning:** Gamification logic for calculating level thresholds via linear iteration (`while (totalXP >= xpNeeded)`) caused significant execution slowdowns on large amounts of XP.
**Action:** Replace iterative calculations matching linear formulas like $y = m*x$ with derived inverse formulas $x = y/m$. In this codebase, leveling logic uses $O(1)$ calculations (`Math.floor(totalXP / 500) + 1`).
