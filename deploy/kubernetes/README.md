# K3s deployment

The blog runs in the `niri-desktop-blog` namespace on the `tc` K3s cluster.
Traefik serves `blog.frozenf1sh.top`, and cert-manager obtains its certificate
through the existing `letsencrypt-prod-dns01` ClusterIssuer. The resources are
applied directly with Kustomize; they are not currently managed by Argo CD.

The node is AMD64. The deployment references the image tag for source commit
`16a8a195475642e85bd9ddd5a8b75418f125dbb2` and uses `imagePullPolicy: Never`.
A copy of the image archive is retained on the node under
`/var/lib/rancher/k3s/agent/images/` for K3s to import at startup. If the node's
image is removed while K3s is running, re-import that archive before restarting
the pod:

```sh
ssh tc 'sudo k3s ctr -n k8s.io images import /var/lib/rancher/k3s/agent/images/niri-desktop-blog-16a8a1954756.tar'
kubectl --kubeconfig ~/.kube/config-tc.yaml apply -k deploy/kubernetes
kubectl --kubeconfig ~/.kube/config-tc.yaml -n niri-desktop-blog rollout status deployment/niri-desktop-blog
```

For a new release, build an AMD64 image from the intended source revision,
transfer and verify its archive, import it on the node, then update the image tag
and revision annotation in `app.yaml` before applying. The archive and manifest
are node-specific: when replacing the node, transfer and import the image on the
new node first. A registry and GitOps reconciliation are not configured for
this deployment.
