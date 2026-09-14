module.exports = function(data){
  if (!data || data.length < 1) return {};
  
  let d = {},
    keys = Object.keys(data);

  for (let i = 0; i < keys.length; i++) {
    let key = keys[i],
      value = data[key],
      current = d,
      keyParts = key
        .replace(new RegExp(/\[/g), '.')
        .replace(new RegExp(/\]/g), '')
        .split('.');

    // Reject the entire field before traversing prototype-related properties.
    if (keyParts.some(part =>
      part === '__proto__' || part === 'constructor' || part === 'prototype'
    )) continue;
  
    for (let index = 0; index < keyParts.length; index++){
      let k = keyParts[index];
      if (index >= keyParts.length - 1){
        current[k] = value;
      } else {
        if (!Object.prototype.hasOwnProperty.call(current, k) || !current[k]) {
          current[k] = !isNaN(keyParts[index + 1]) ? [] : {};
        }
        current = current[k];
      }
    }
  }
  
  return d;
};
