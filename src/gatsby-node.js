const fetch = require(`node-fetch`)
const path = require(`path`)
const Dropbox = require(`dropbox`).Dropbox

const defaultOptions = {
  path: ``,
  recursive: true,
  limit: 2000,
  createFolderNodes: false,
  extensions: [`.jpg`, `.png`, `.md`],
}

const NODE_TYPES = {
  MARKDOWN: `dropboxMarkdown`,
  IMAGE: `dropboxImage`,
  FOLDER: `dropboxFolder`,
  DEFAULT: `dropboxNode`,
}

/**
 * Dropbox API calls
 */

async function getFolderId(dbx, path) {
  return dbx.filesGetMetadata({ path })
}

async function listFiles(dbx, path, recursive, limit) {
  return dbx.filesListFolder({ path, recursive, limit: limit })
}

async function getPublicUrl(dbx, path) {
  return dbx.sharingCreateSharedLink({ path})
}

/**
 * Get the folder id from a path and then retrieve and filter files
 */

async function getData(dbx, options) {
  let folderId = ``
  try {
    if (options.path !== ``) {
      const folder = await getFolderId(dbx, options.path)
      folderId = folder.id
    }
    const files = await listFiles(dbx, folderId, options.recursive, options.limit)
    return files
  } catch (e) {
    return []
  }
}

/**
 * Generate Public Urls
 */
async function processRemoteFile( { dbx, datum }) {
  const publicUrl = await getPublicUrl(dbx, datum.path)
  datum.url = publicUrl.url.replace('dl=0','raw=1').replace("www.dropbox.com","dl.dropboxusercontent.com")
  return datum
}

/**
 * Helper functions for node creation
 */

function extractFiles(data, options){
  return data.entries.filter(entry => entry[`.tag`] === `file` && options.extensions.includes(path.extname(entry.name)))
}

function extractFolders(data){
 return data.entries.filter(entry => entry[`.tag`] === `folder`)
}

function getNodeType(file, options) {
  let nodeType = NODE_TYPES.DEFAULT

  if(options.createFolderNodes) {
    const extension = path.extname(file.path_display)

    switch(extension) {
      case `.md`:
        nodeType = NODE_TYPES.MARKDOWN
        break
      case `.png`:
        nodeType = NODE_TYPES.IMAGE
        break
      case `.jpg`:
        nodeType = NODE_TYPES.IMAGE
        break
      case `.jpeg`:
        nodeType = NODE_TYPES.IMAGE
        break
      default:
        nodeType = NODE_TYPES.DEFAULT
        break
    }
  }

  return nodeType
}

/**
 * Function to create linkable nodes
 */

function createNodeData(data, options, createContentDigest) {
  const files = extractFiles(data, options)

  const fileNodes = files.map(file => {
    const nodeDatum = {
      id: file.id,
      parent: `__SOURCE__`,
      children: [],
      path: file.path_display,
      name: file.name,
      lastModified: file.client_modified,
    }
    console.log(file.name)
    return {
      ...nodeDatum,
      internal: {
        type: getNodeType(file, options),
        contentDigest: createContentDigest(nodeDatum),
      },
    }
  })

  if(options.createFolderNodes) {
    const folders = extractFolders(data)
  
    const folderNodes = folders.map(folder => {
      const nodeDatum = {
        id: folder.id,
        parent: `__SOURCE__`,
        children: [],
        path: `root${folder.path_display}`,
        name: folder.name,
        directory: path.dirname(`root${folder.path_display}`),
      }
      return{
        ...nodeDatum,
        internal: {
          type: NODE_TYPES.FOLDER,
          contentDigest: createContentDigest(nodeDatum),
        },
      }
    })
  
    // Creating an extra node for the root folder
    const rootDatum = {
      id: `dropboxRoot`,
      parent: `__SOURCE__`,
      children: [],
      name: `root`,
      path: `root/`,
      folderPath: `root`,
    }
    folderNodes.push({
      ...rootDatum,
      internal: {
        type: NODE_TYPES.FOLDER,
        contentDigest: createContentDigest(rootDatum),
      },
    })

    const nodes = [...fileNodes, ...folderNodes]
    return nodes

  } else {
    return fileNodes
  }
}

exports.sourceNodes = async (
  { actions: { createNode, touchNode }, store, cache, createNodeId, createContentDigest },
  pluginOptions,
  ) => {
  const options = { ...defaultOptions, ...pluginOptions }
  const dbx = new Dropbox({ fetch, accessToken: options.accessToken })
  const data = await getData(dbx, options)
  /*
  const nodeData = createNodeData(data, options, createContentDigest)

  return Promise.all(
    nodeData.map(async nodeDatum => {
      const node = await processRemoteFile({
        datum: nodeDatum ,
        dbx,
        createNode,
        touchNode,
        store,
        cache,
        createNodeId,
      })
      createNode(node)
    })
  )
  */
}

/**
 * Schema definitions to link files to folders
 */

exports.createSchemaCustomization = ({ actions }, pluginOptions) => {
  const options = { ...defaultOptions, ...pluginOptions }

  if(options.createFolderNodes) {
    const { createTypes } = actions
    const typeDefs = [
      `type dropboxImage implements Node {
        path: String,
        directory: String,
        name: String,
        lastModified: String,
      }`,
      `type dropboxMarkdown implements Node {
        path: String,
        directory: String,
        name: String,
        lastModified: String,
      }`,
      `type dropboxFolder implements Node {
        dropboxImage: [dropboxImage] @link(from: "path", by: "directory")
        dropboxMarkdown: [dropboxMarkdown] @link(from: "path", by: "directory")
      }`,
    ]
    createTypes(typeDefs)
  }
}
