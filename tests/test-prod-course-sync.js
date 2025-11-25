exports.main = async (event, callback) => {
  const total_enrollment = event.inputFields['total_enrollment'];
  const HS_TOKEN = process.env.HS_TOKEN; 
  
  
  const url = 'https://api.hubapi.com/crm/v3/objects/products/search';
  const options = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${HS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      filterGroups: [
        {
          filters: [
            {
              propertyName: "name",
              operator: "EQ",
              value: total_enrollment // This should be a string value
            }
          ]
        }
      ],
      properties: ["name", "current_enrollments"], // Properties go at top level
      limit: 100
    })
  };
  
  const productUpdater = () => {
    const url = 'https://api.hubapi.com/crm/v3/objects/products/{productId}';
    const options = {
      method: 'PATCH',
      headers: {Authorization: `Bearer ${HS_TOKEN}`, 'Content-Type': 'application/json'},
      body: '{"properties":	{"current_enrollments":"value"}}'
 
};

try {
  const response = await fetch(url, options);
  const data = await response.json();
  console.log(data);
} catch (error) {
  console.error(error);
}
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}