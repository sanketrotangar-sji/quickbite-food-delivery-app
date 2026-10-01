# RAG evaluation report

Generated: 2026-09-30T20:04:54.732Z
Model: nomic-embed-text · k=5

## Summary

| Set | Avg hit-rate@k | Avg precision@k |
|-----|----------------|-----------------|
| matching | 37.5% | 10.0% |
| extreme | 0.0% | 0.0% |
| noisy | 20.0% | 5.0% |

## Clean vs noisy delta

- Matching: hit-rate 37.5% → noisy 20.0% (noisy set includes matching-derived queries)
- Matching precision: 10.0% vs noisy 5.0%

## matching

### m1
Query: Masala Dosa
Hit: no · precision@5: 0.000

### m2
Query: Chicken Biryani
Hit: no · precision@5: 0.000

### m3
Query: Chilli paneer dry
Hit: no · precision@5: 0.000

### m4
Query: Filter Coffee
Hit: no · precision@5: 0.000

### m5
Query: Ukadiche Modak
Hit: no · precision@5: 0.000

### m6
Query: Kothimbir Vadi
Hit: yes · precision@5: 0.400

### m7
Query: Margherita
Hit: yes · precision@5: 0.200

### m8
Query: Kingfish curry
Hit: yes · precision@5: 0.200

## extreme

### e1
Query: vegan sushi rolls under 50 rupees gluten free
Hit: no · precision@5: n/a

### e2
Query: something nice maybe food?
Hit: no · precision@5: n/a

### e3
Query: extra spicy Chilli paneer dry under 180 veg only no onion quick delivery rating 5 stars
Hit: no · precision@5: 0.000

### e4
Query: truffle wagyu steak well done
Hit: no · precision@5: n/a

## noisy

### n1
Query: masale dose asdf xxx
Hit: no · precision@5: 0.000

### n2
Query: chicken biryany asdf xxx
Hit: yes · precision@5: 0.200

### n3
Query: chilli paneer dry asdf xxx
Hit: yes · precision@5: 0.200

### n4
Query: filter coffee asdf xxx
Hit: no · precision@5: 0.000

### n5
Query: ukadiche modak asdf xxx
Hit: no · precision@5: 0.000

### n6
Query: kothimbyr vadi asdf xxx
Hit: no · precision@5: 0.000

### n7
Query: margheryta asdf xxx
Hit: no · precision@5: 0.000

### n8
Query: kingfish curry asdf xxx
Hit: no · precision@5: 0.000

### n9
Query: vegan suhsi rollz undr 50 rs glutenfreeeee
Hit: no · precision@5: n/a

### n10
Query: extra spicy chylli peneer dry under 180 veg only no onion quick delivery rating 5 stars asdf xxx
Hit: no · precision@5: n/a
