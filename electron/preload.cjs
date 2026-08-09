const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('plum', {
  getContext: () => ipcRenderer.invoke('plum:get-context'),
  chooseBlog: () => ipcRenderer.invoke('plum:choose-blog'),
  listPosts: () => ipcRenderer.invoke('plum:list-posts'),
  readPost: (id) => ipcRenderer.invoke('plum:read-post', id),
  savePost: (post) => ipcRenderer.invoke('plum:save-post', post),
  createPost: (input) => ipcRenderer.invoke('plum:create-post', input),
  importImages: (postId) => ipcRenderer.invoke('plum:import-images', postId),
  readAsset: (postId, name) => ipcRenderer.invoke('plum:read-asset', postId, name),
  gitStatus: () => ipcRenderer.invoke('plum:git-status'),
  syncGit: (message) => ipcRenderer.invoke('plum:sync-git', message),
  openPreview: () => ipcRenderer.invoke('plum:open-preview'),
})
