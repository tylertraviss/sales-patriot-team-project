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

GET /api/vendors
  ?page=1&limit=25
  ?sort=totalObligated&order=desc
  ?year=2010
  ?naicsCode=517110
  ?stateCode=VA
  ?agencyCode=9700
  ?setAsideType=SBA
  ?search=indyne          ← name search

GET /api/vendors/:uei
GET /api/vendors/:uei/awards
  ?page=1&limit=25
  ?sort=dollarsObligated&order=desc
  ?year=2010
  ?agencyCode=9700
  ?awardType=DEFINITIVE+CONTRACT

GET /api/vendors/:uei/awards/summary   ← aggregates only, no pagination needed

GET /api/awards
  ?page=1&limit=25
  ?sort=dollarsObligated&order=desc
  ?year=2010
  ?agencyCode=9700
  ?naicsCode=517110
  ?stateCode=CA
  ?awardType=DEFINITIVE+CONTRACT
  ?extentCompeted=D
  ?search=communications   ← searches descriptionOfRequirement

GET /api/agencies
  ?page=1&limit=25
  ?sort=name&order=asc

GET /api/agencies/:code/awards
  ?page=1&limit=25
  ?sort=dollarsObligated&order=desc
  ?year=2010

GET /api/agencies/:code/vendors
  ?page=1&limit=25
  ?sort=totalObligated&order=desc

GET /api/naics
  ?page=1&limit=25
  ?sort=totalObligated&order=desc

GET /api/naics/:code/awards
  ?page=1&limit=25
  ?year=2010

GET /api/naics/:code/vendors
  ?page=1&limit=25
Pagination response envelope — every paginated endpoint returns:


{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 84201,
    "totalPages": 3369
  }
}