export function getCollectionStats(identifier: string) {
  return `
  WITH
    endedAuctions AS (select  SUM(o.priceAmountDenominated) AS volumeTraded, 
      AVG(o.priceAmountDenominated) AS saleAverage,
      MAX(o.priceAmountDenominated) AS maxPrice,
      SUM(if(a.status='Ended', 1, 0)) AS auctionsEnded,
      a.collection AS endedIdentifier
    FROM orders o 
    LEFT JOIN auctions a ON o.auctionId = a.id 
    WHERE a.collection  = '${identifier}' AND o.status = 'Bought'),

    activeAuctions AS (SELECT MIN(if(o.priceAmountDenominated, o.priceAmount , a.minBid)) AS minPrice, 
    COUNT(DISTINCT(a.id)) AS activeAuctions,
    a.collection AS activeIdentifier
    FROM auctions a
    LEFT JOIN orders o ON o.auctionId = a.id 
    WHERE a.collection  = '${identifier}' AND a.status = 'Running') 

    SELECT volumeTraded, saleAverage, maxPrice, auctionsEnded, activeAuctions, minPrice
    FROM (
    SELECT * FROM endedAuctions ea
    LEFT JOIN activeAuctions aa ON aa.activeIdentifier = '${identifier}'
    ) temp
  `;
}
