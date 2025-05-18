const generateLastModifiedDateFilter = (date, nowDate, propertyName = 'hs_lastmodifieddate') => {
    return date
      ? {
          filters: [
            { propertyName, operator: 'GTE', value: `${date.valueOf()}` },
            { propertyName, operator: 'LTE', value: `${nowDate.valueOf()}` }
          ]
        }
      : {};
  };

  module.exports = { generateLastModifiedDateFilter };
