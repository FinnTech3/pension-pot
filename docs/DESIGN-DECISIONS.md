# Design decisions

The questions I would expect to be asked about this, and the answers.

## Why price annuities from scratch rather than use published rates?

Because published rates only exist for today. To say what the same retirement
cost in 2021 or 2005, I need a price that can be recomputed from things with a
long history: the Bank of England's gilt curves and the ONS's mortality
projections. Pricing from those, and checking the result against what insurers
quote today, is what lets the history mean anything.

## Why only two tuned numbers, and why those two?

An annuity price is the sum of every future payment, weighted by the chance
the buyer is alive for it and discounted at the gilt curve plus a margin.
Two things are not in public data: the insurer's margin over gilts, and how
much longer annuity buyers live than the population. The level quotes at 65
and 75 pin both down, because the margin moves every age's price alike while
mortality matters more the older the buyer. They come out at 0.60 points over
gilts and 60% of the population's death rates. Both point the right way:
insurers invest in bonds that yield more than gilts, and people who buy
annuities are healthier and wealthier than the population the ONS table
describes.

## Why is the check limited to 65 and over?

Because that is the range the project prices, and I only found the problem
below it by widening the check. The first version tested four quotes and
passed. Testing all 30 on the page showed the model offering 1.3% to 4.0% too
much income at 55 and 60, every time in the same direction, while every quote
from 65 to 75 stayed within 1.5%. One possible reason is that insurers charge more
for the longer, riskier payouts of younger buyers, which one flat margin
cannot capture. Rather than widen the tolerance or drop the young quotes, the
gate covers the ages used, and a test pins the young-age bias so it stays
visible.

## Why an inflation-linked annuity as the central case?

The standards are spending in today's money. A level annuity pays the same
pounds for life, and at 2% inflation those pounds buy a third less after
twenty years. The level pot is shown beside it, because it is what many people
buy, and it is smaller for exactly that reason.

## Why an annuity at all, when most people use drawdown?

Because an annuity has a price. Drawdown depends on investment returns and on
how long you live, so "how big a pot do I need" has no single answer for it,
only a probability. The annuity price is the certain cost of an income for
life, which makes it the fair way to compare one year with another. The README
says so and does not model drawdown.

## Why hold margins and mortality at today's levels for the history?

So that only one thing moves: gilt yields. That isolates what the market for
long-dated gilts did to the cost of a retirement. It is not what an insurer
would have quoted in each past month, and I could not find a citable record of
past quotes to check how far apart the two are.

## How is a couple handled?

As two people of the same age, each with a full state pension and their own
personal allowance, each buying an inflation-linked annuity that lifts them the
rest of the way to half the couple's standard. The state pension counts towards
the standard, not on top of it, so where two state pensions already clear the
standard, as they do for the two-person minimum, there is no annuity to buy and
no pot needed. It is simple and it is honest about one gap: when one dies,
the survivor keeps their own annuity and state pension, which is less than the
one-person standard. A joint-life annuity would protect the survivor and cost
more.

## Why no London option?

The June 2026 standards do not publish London figures. Inventing an uplift
would put a number on the page with nothing behind it.

## Why a yield slider rather than a forecast?

Nobody knows where gilt yields are going. The slider shows how sensitive the
answer is, which is the useful thing to know: for a comfortable retirement
at 66, yields one point higher cut the pot by 10% and one point lower raise
it by 12%.

## Why draw the history as a ridge, and start it at zero?

The price of the same retirement has run from £704k to £1.40m and back. A
line on its own would say the price moved; a filled ridge says the price is a
quantity of money you have to have, and the area under it reads as that
quantity. That only works if the base is zero, so the base is zero, and about
half the picture is flat. That is the honest half: the retirement never got
cheap, it got twice as dear and came back.

## Why does the dial move a line rather than redraw the ridge?

Shifting gilt yields changes what the retirement costs today. It cannot change
what it cost in 2011, because that price was set by the curve on the day. So
the dial moves today's price up and down against a fixed history, and the page
says which month that price was last seen in. Redrawing the whole ridge would
imply a counterfactual past the data cannot support.

## Why no charting library?

The charts are a line, a curve and the ridge. Drawn as SVG directly they
resize to the screen so their text stays readable on a phone, and the page
stays under 62 KB of JavaScript.
