"use strict";

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

const fetch = require(`node-fetch`);

const path = require(`path`);

const Dropbox = require(`dropbox`).Dropbox;

const defaultOptions = {
  path: ``,
  recursive: true,
  limit: 2000,
  createFolderNodes: false,
  extensions: [`.jpg`, `.png`, `.md`]
};
const NODE_TYPES = {
  MARKDOWN: `dropboxMarkdown`,
  IMAGE: `dropboxImage`,
  FOLDER: `dropboxFolder`,
  DEFAULT: `dropboxNode`
};
/**
 * Dropbox API calls
 */

function getFolderId(_x, _x2) {
  return _getFolderId.apply(this, arguments);
}

function _getFolderId() {
  _getFolderId = _asyncToGenerator(function* (dbx, path) {
    return dbx.filesGetMetadata({
      path
    });
  });
  return _getFolderId.apply(this, arguments);
}

function listFiles(_x3, _x4, _x5, _x6) {
  return _listFiles.apply(this, arguments);
}

function _listFiles() {
  _listFiles = _asyncToGenerator(function* (dbx, path, recursive, limit) {
    return dbx.filesListFolder({
      path,
      recursive,
      limit: limit
    });
  });
  return _listFiles.apply(this, arguments);
}

function getPublicUrl(_x7, _x8) {
  return _getPublicUrl.apply(this, arguments);
}
/**
 * Get the folder id from a path and then retrieve and filter files
 */


function _getPublicUrl() {
  _getPublicUrl = _asyncToGenerator(function* (dbx, path) {
    return dbx.sharingCreateSharedLink({
      path
    });
  });
  return _getPublicUrl.apply(this, arguments);
}

function getData(_x9, _x10) {
  return _getData.apply(this, arguments);
}
/**
 * Generate Public Urls
 */


function _getData() {
  _getData = _asyncToGenerator(function* (dbx, options) {
    let folderId = ``;

    try {
      if (options.path !== ``) {
        const folder = yield getFolderId(dbx, options.path);
        folderId = folder.id;
      }

      const files = yield listFiles(dbx, folderId, options.recursive, options.limit);
      return files;
    } catch (e) {
      console.warn(e.error);
      return [];
    }
  });
  return _getData.apply(this, arguments);
}

function processRemoteFile(_x11) {
  return _processRemoteFile.apply(this, arguments);
}
/**
 * Helper functions for node creation
 */


function _processRemoteFile() {
  _processRemoteFile = _asyncToGenerator(function* ({
    dbx,
    datum
  }) {
    const publicUrl = yield getPublicUrl(dbx, datum.path);
    datum.url = publicUrl.url.replace('dl=0', 'raw=1').replace("www.dropbox.com", "dl.dropboxusercontent.com");
    console.log(datum.url);
    return datum;
  });
  return _processRemoteFile.apply(this, arguments);
}

function extractFiles(data, options) {
  return data.entries.filter(entry => entry[`.tag`] === `file` && options.extensions.includes(path.extname(entry.name)));
}

function extractFolders(data) {
  return data.entries.filter(entry => entry[`.tag`] === `folder`);
}

function getNodeType(file, options) {
  let nodeType = NODE_TYPES.DEFAULT;

  if (options.createFolderNodes) {
    const extension = path.extname(file.path_display);

    switch (extension) {
      case `.md`:
        nodeType = NODE_TYPES.MARKDOWN;
        break;

      case `.png`:
        nodeType = NODE_TYPES.IMAGE;
        break;

      case `.jpg`:
        nodeType = NODE_TYPES.IMAGE;
        break;

      case `.jpeg`:
        nodeType = NODE_TYPES.IMAGE;
        break;

      default:
        nodeType = NODE_TYPES.DEFAULT;
        break;
    }
  }

  return nodeType;
}
/**
 * Function to create linkable nodes
 */


function createNodeData(data, options, createContentDigest) {
  const files = extractFiles(data, options);
  const fileNodes = files.map(file => {
    const nodeDatum = {
      id: file.id,
      parent: `__SOURCE__`,
      children: [],
      path: file.path_display,
      name: file.name,
      lastModified: file.client_modified
    };
    return _objectSpread(_objectSpread({}, nodeDatum), {}, {
      internal: {
        type: getNodeType(file, options),
        contentDigest: createContentDigest(nodeDatum)
      }
    });
  });

  if (options.createFolderNodes) {
    const folders = extractFolders(data);
    const folderNodes = folders.map(folder => {
      const nodeDatum = {
        id: folder.id,
        parent: `__SOURCE__`,
        children: [],
        path: `root${folder.path_display}`,
        name: folder.name,
        directory: path.dirname(`root${folder.path_display}`)
      };
      return _objectSpread(_objectSpread({}, nodeDatum), {}, {
        internal: {
          type: NODE_TYPES.FOLDER,
          contentDigest: createContentDigest(nodeDatum)
        }
      });
    }); // Creating an extra node for the root folder

    const rootDatum = {
      id: `dropboxRoot`,
      parent: `__SOURCE__`,
      children: [],
      name: `root`,
      path: `root/`,
      folderPath: `root`
    };
    folderNodes.push(_objectSpread(_objectSpread({}, rootDatum), {}, {
      internal: {
        type: NODE_TYPES.FOLDER,
        contentDigest: createContentDigest(rootDatum)
      }
    }));
    const nodes = [...fileNodes, ...folderNodes];
    return nodes;
  } else {
    return fileNodes;
  }
}

exports.sourceNodes = /*#__PURE__*/function () {
  var _ref = _asyncToGenerator(function* ({
    actions: {
      createNode,
      touchNode
    },
    store,
    cache,
    createNodeId,
    createContentDigest
  }, pluginOptions) {
    const options = _objectSpread(_objectSpread({}, defaultOptions), pluginOptions);

    const dbx = new Dropbox({
      fetch,
      accessToken: options.accessToken
    });
    const data = yield getData(dbx, options);
    const nodeData = createNodeData(data, options, createContentDigest);
    return Promise.all(nodeData.map( /*#__PURE__*/function () {
      var _ref2 = _asyncToGenerator(function* (nodeDatum) {
        const node = yield processRemoteFile({
          datum: nodeDatum,
          dbx,
          createNode,
          touchNode,
          store,
          cache,
          createNodeId
        });
        createNode(node);
      });

      return function (_x14) {
        return _ref2.apply(this, arguments);
      };
    }()));
  });

  return function (_x12, _x13) {
    return _ref.apply(this, arguments);
  };
}();
/**
 * Schema definitions to link files to folders
 */


exports.createSchemaCustomization = ({
  actions
}, pluginOptions) => {
  const options = _objectSpread(_objectSpread({}, defaultOptions), pluginOptions);

  if (options.createFolderNodes) {
    const createTypes = actions.createTypes;
    const typeDefs = [`type dropboxImage implements Node {
        path: String,
        directory: String,
        name: String,
        lastModified: String,
      }`, `type dropboxMarkdown implements Node {
        path: String,
        directory: String,
        name: String,
        lastModified: String,
      }`, `type dropboxFolder implements Node {
        dropboxImage: [dropboxImage] @link(from: "path", by: "directory")
        dropboxMarkdown: [dropboxMarkdown] @link(from: "path", by: "directory")
      }`];
    createTypes(typeDefs);
  }
};