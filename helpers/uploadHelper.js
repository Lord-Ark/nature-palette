const path = require('path');

function getUploadFileName(file) {
  if (!file || typeof file.name !== 'string') {
    return '';
  }

  return path.posix.basename(file.name.replace(/\\/g, '/'));
}

exports.uploadFileToServer = function(file,callBackFun) {
  const uploadPath = path.join(path.dirname(__dirname), 'uploads', getUploadFileName(file));

  file.mv(uploadPath, callBackFun);

  return path.resolve(path.normalize(uploadPath));
};
