const { contextBridge, ipcRenderer, webUtils } = require('electron')

contextBridge.exposeInMainWorld('plum', {
  getContext: () => ipcRenderer.invoke('plum:get-context'),
  chooseBlog: () => ipcRenderer.invoke('plum:choose-blog'),
  listPosts: () => ipcRenderer.invoke('plum:list-posts'),
  readPost: (id) => ipcRenderer.invoke('plum:read-post', id),
  savePost: (post) => ipcRenderer.invoke('plum:save-post', post),
  createPost: (input) => ipcRenderer.invoke('plum:create-post', input),
  importImages: (postId) => ipcRenderer.invoke('plum:import-images', postId),
  importDroppedImages: (postId, files) => {
    const sourcePaths = files.map((file) => webUtils.getPathForFile(file)).filter(Boolean)
    return ipcRenderer.invoke('plum:import-image-paths', postId, sourcePaths)
  },
  readAsset: (postId, name) => ipcRenderer.invoke('plum:read-asset', postId, name),
  gitStatus: () => ipcRenderer.invoke('plum:git-status'),
  gitConfig: () => ipcRenderer.invoke('plum:git-config'),
  saveGitConfig: (config) => ipcRenderer.invoke('plum:save-git-config', config),
  syncGit: (message) => ipcRenderer.invoke('plum:sync-git', message),
  openPreview: () => ipcRenderer.invoke('plum:open-preview'),
})
