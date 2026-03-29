# sales-patriot-team-project

200 GB of data. One group in charge of backend, one group is in charge of front end.

It's data about revenue for companies through DLA.

Backend is server/api/data upload
Front end: data upload

for backend

send the front end the headers so they will figure out how to display it on front end.

data of awards to different companies in the past.

CAGE code is company name 

We want to know everything about this years rewards. what company should i invest in. top 3 cage codes i should invest in

GET /api/vendors?sort=totalObligated&order=desc&year=2010
GET /api/vendors/:uei
GET /api/vendors/:uei/awards
GET /api/vendors/:uei/awards?year=2010
GET /api/vendors/:uei/awards/summary       ← sub-resource, aggregate view

GET /api/awards?year=2010&sort=dollarsObligated
GET /api/awards?naicsCode=517110
GET /api/awards?agencyCode=9700&extentCompeted=D

GET /api/agencies
GET /api/agencies/:code/awards
GET /api/agencies/:code/vendors

GET /api/naics
GET /api/naics/:code/awards
GET /api/naics/:code/vendors
