-- Correct the "Knowing When to Fold" demo hand (SVH-49QWW2ZC)
-- Updates ONLY this one hand's normalized_hand and the Spot's hand_details text.
-- Does not touch any other Spot, hand, or global logic.

UPDATE sv_manual_hand_records
SET normalized_hand = '{
  "handId": "SVH-49QWW2ZC",
  "site": "manual",
  "gameType": "Hold''em",
  "stakes": "500/1000",
  "date": "2026-10-12T17:40:43.963Z",
  "tableName": "Poker Power Final Table",
  "buttonSeat": 4,
  "heroName": "Emily",
  "title": "9dTd — SB vs CO — Built Hand",
  "players": [
    {"seat": 1, "name": "Sarah", "stack": 42000, "position": "UTG", "isHero": false},
    {"seat": 2, "name": "Amanda", "stack": 28000, "position": "HJ", "isHero": false},
    {"seat": 3, "name": "Jennifer", "stack": 36000, "position": "CO", "isHero": false, "holeCards": ["As","Qs"], "revealMode": "reveal_at_showdown", "showdownCards": ["As","Qs"]},
    {"seat": 4, "name": "Michelle", "stack": 51000, "position": "BTN", "isHero": false},
    {"seat": 5, "name": "Emily", "stack": 40000, "position": "SB", "isHero": true, "holeCards": ["9d","Td"]},
    {"seat": 6, "name": "Rachel", "stack": 55000, "position": "BB", "isHero": false}
  ],
  "actions": [
    {"index": 0, "street": "preflop", "player": "Sarah", "type": "post_ante", "amount": 100},
    {"index": 1, "street": "preflop", "player": "Amanda", "type": "post_ante", "amount": 100},
    {"index": 2, "street": "preflop", "player": "Jennifer", "type": "post_ante", "amount": 100},
    {"index": 3, "street": "preflop", "player": "Michelle", "type": "post_ante", "amount": 100},
    {"index": 4, "street": "preflop", "player": "Emily", "type": "post_ante", "amount": 100},
    {"index": 5, "street": "preflop", "player": "Rachel", "type": "post_ante", "amount": 100},
    {"index": 6, "street": "preflop", "player": "Emily", "type": "post_sb", "amount": 500},
    {"index": 7, "street": "preflop", "player": "Rachel", "type": "post_bb", "amount": 1000},
    {"index": 8, "street": "preflop", "player": "Sarah", "type": "fold"},
    {"index": 9, "street": "preflop", "player": "Amanda", "type": "fold"},
    {"index": 10, "street": "preflop", "player": "Jennifer", "type": "raise", "amount": 2500},
    {"index": 11, "street": "preflop", "player": "Michelle", "type": "fold"},
    {"index": 12, "street": "preflop", "player": "Emily", "type": "call", "amount": 2000},
    {"index": 13, "street": "preflop", "player": "Rachel", "type": "fold"},
    {"index": 14, "street": "flop", "player": "Emily", "type": "check"},
    {"index": 15, "street": "flop", "player": "Jennifer", "type": "bet", "amount": 4000},
    {"index": 16, "street": "flop", "player": "Emily", "type": "call", "amount": 4000},
    {"index": 17, "street": "turn", "player": "Emily", "type": "check"},
    {"index": 18, "street": "turn", "player": "Jennifer", "type": "bet", "amount": 10000},
    {"index": 19, "street": "turn", "player": "Emily", "type": "call", "amount": 10000},
    {"index": 20, "street": "river", "player": "Emily", "type": "check"},
    {"index": 21, "street": "river", "player": "Jennifer", "type": "allin", "amount": 19400},
    {"index": 22, "street": "river", "player": "Emily", "type": "fold"},
    {"index": 23, "street": "river", "player": "Jennifer", "type": "collect", "amount": 54000}
  ],
  "board": {"flop": ["Qh","9s","2c"], "turn": "3c", "river": "7d"},
  "pot": 54000,
  "rake": 0,
  "winners": [{"player": "Jennifer", "amount": 54000}],
  "rawText": ""
}'::jsonb
WHERE hand_id = 'SVH-49QWW2ZC';

-- Update the Spot's hand_details text to match the corrected hand
UPDATE content_spots
SET hand_details = 'Poker Power Free Tournament Night
Final Table · 6-Handed · No-Limit Hold''em
Blinds: 500/1,000 · Ante: 100 per player

Players & Starting Stacks
Position	Player	Stack
UTG	Sarah	42,000
HJ	Amanda	28,000
CO	Jennifer	36,000
BTN	Michelle	51,000
SB	Emily (Hero)	40,000
BB	Rachel	55,000
HERO — EMILY (SB)
9♦T♦


Preflop
Sarah (UTG) folds. Amanda (HJ) folds. Jennifer (CO) raises to 2,500. Michelle (BTN) folds. Emily (SB) calls 2,000. Rachel (BB) folds.
Pot: 6,600

Flop — Qh9s2c
Emily checks. Jennifer bets 4,000. Emily calls 4,000.
Pot: 14,600

Turn — 3c
Emily checks. Jennifer bets 10,000. Emily calls 10,000.
Pot: 34,600

River — 7d
Emily checks. Jennifer shoves all-in for 19,400.
DECISION POINT — EMILY
Hero''s hand
9dTd

Board
Qh9s2c3c7d

Pot before river bet
34,600

Jennifer''s bet
19,400

Emily''s remaining stack
23,400

Amount already invested
16,600


Should Emily call 19,400 or fold?

Opponent Profile
Jennifer is a cautious, relatively tight player who rarely bluffs, particularly when making large river bets.
Educational Theme — The Sunk Cost Fallacy
Emily has already invested 16,600 chips. However, those chips are no longer hers. Her decision should depend on whether calling is profitable given the available information, not on how much she has already invested.

Result
Emily folds. Jennifer wins the 54,000-chip pot uncontested. Jennifer''s hole cards are revealed: A♠Q♠.',
    updated_at = now()
WHERE id = '2c0256e6-213b-457b-b1d6-0f72ee7f725b';
