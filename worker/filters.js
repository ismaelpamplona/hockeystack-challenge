const generateLastModifiedDateFilter = (date, nowDate, propertyName = 'hs_lastmodifieddate') => date ?
  {
    filters: [
      { propertyName, operator: 'GTE', value: `${date.valueOf()}` },
      { propertyName, operator: 'LTE', value: `${nowDate.valueOf()}` }
    ]
  } :
  {};

module.exports = { generateLastModifiedDateFilter };
