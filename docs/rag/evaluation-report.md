# RAG evaluation report

Generated: 2026-09-29T19:46:09.049Z
Model: nomic-embed-text · k=5

## Summary

| Set | Avg hit-rate@k | Avg precision@k |
|-----|----------------|-----------------|
| matching | 25.0% | 12.5% |
| extreme | 0.0% | 0.0% |
| noisy | 10.0% | 5.0% |

## Clean vs noisy delta

- Matching: hit-rate 25.0% → noisy 10.0% (noisy set includes matching-derived queries)
- Matching precision: 12.5% vs noisy 5.0%

## matching

### m1
Query: vegetarian dishes under 200 rupees
Hit: no · precision@5: 0.000

### m2
Query: paneer tikka starter
Hit: no · precision@5: 0.000

### m3
Query: mutton dum biryani
Hit: yes · precision@5: 0.600

### m4
Query: masala dosa south indian breakfast
Hit: no · precision@5: 0.000

### m5
Query: filter coffee beverage
Hit: no · precision@5: 0.000

### m6
Query: spicy mutton biryani under 400
Hit: yes · precision@5: 0.400

### m7
Query: bebinca dessert slice
Hit: no · precision@5: 0.000

### m8
Query: pure veg light snack under 150
Hit: no · precision@5: 0.000

## extreme

### e1
Query: vegan sushi rolls under 50 rupees gluten free
Hit: no · precision@5: n/a

### e2
Query: something nice maybe food?
Hit: no · precision@5: n/a

### e3
Query: extra spicy paneer tikka under 180 veg only no onion quick delivery rating 5 stars comment packaging
Hit: no · precision@5: 0.000

### e4
Query: truffle wagyu steak well done
Hit: no · precision@5: n/a

## noisy

### n1
Query: vegitarian dishs undr 200 rs pls !!!
Hit: no · precision@5: 0.000

### n2
Query: pnner tika strter lol asdf
Hit: no · precision@5: 0.000

### n3
Query: muton dum briyani xxxx
Hit: no · precision@5: 0.000

### n4
Query: masala dosa southindian brkfast zzz
Hit: no · precision@5: 0.000

### n5
Query: filtter coffe bevrage qwerty
Hit: no · precision@5: 0.000

### n6
Query: spicy mutton biryani undr 400 rupees !!!
Hit: yes · precision@5: 0.400

### n7
Query: bebinca desrt slce yum
Hit: no · precision@5: 0.000

### n8
Query: pure veg lite snak undr 150 thx
Hit: no · precision@5: 0.000

### n9
Query: vegan suhsi rollz undr 50 rs glutenfreeeee
Hit: no · precision@5: n/a

### n10
Query: xtra spicy paneer tikka undr 180 veg onlyyy
Hit: no · precision@5: n/a
