# RAG evaluation report

Generated: 2026-10-09T06:49:44.907Z
Model: qwen3-embedding:0.6b · k=5

## Summary

| Set | Avg hit-rate@k | Avg precision@k |
|-----|----------------|-----------------|
| matching | 50.0% | 20.0% |
| extreme | 0.0% | 0.0% |
| noisy | 20.0% | 6.7% |

## Notes (Phase 0b)

- Labels rebound to live dish names; see `docs/rag-a3/baseline-v0.json`.
- Index unchanged (pre-hybrid, pre-20K).

## matching

### m1
Query: Masala Dosa
Hit: yes · precision@5: 0.400

### m2
Query: Chicken Biryani
Hit: no · precision@5: 0.000

### m3
Query: Chilli paneer dry
Hit: yes · precision@5: 0.200

### m4
Query: Filter Coffee
Hit: yes · precision@5: 0.400

### m5
Query: Ukadiche Modak
Hit: no · precision@5: 0.000

### m6
Query: Kothimbir Vadi
Hit: no · precision@5: 0.000

### m7
Query: Margherita
Hit: yes · precision@5: 0.600

### m8
Query: Kingfish curry
Hit: no · precision@5: 0.000

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
Hit: no · precision@5: 0.000

### n3
Query: chilli paneer dry asdf xxx
Hit: yes · precision@5: 0.200

### n4
Query: filter coffee asdf xxx
Hit: yes · precision@5: 0.400

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
Hit: no · precision@5: 0.000

