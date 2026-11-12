import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/app_listing.dart';

class AppService {
  AppService({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  CollectionReference<Map<String, dynamic>> get _apps =>
      _firestore.collection('apps');

  Stream<List<AppListing>> watchExploreApps() {
    return _apps
        .where('status', whereIn: ['recruiting', 'test-completed'])
        .snapshots()
        .map(
          (snapshot) => snapshot.docs
              .map(AppListing.fromDocument)
              .toList()
            ..sort((a, b) {
              final aTime = a.createdAt?.millisecondsSinceEpoch ?? 0;
              final bTime = b.createdAt?.millisecondsSinceEpoch ?? 0;
              return bTime.compareTo(aTime);
            }),
        );
  }

  Stream<List<AppListing>> watchMyApps(String userId) {
    return _apps
        .where('developerId', isEqualTo: userId)
        .where('status', isNotEqualTo: 'deleted')
        .snapshots()
        .map(
          (snapshot) => snapshot.docs
              .map(AppListing.fromDocument)
              .toList()
            ..sort((a, b) => a.name.compareTo(b.name)),
        );
  }

  Stream<AppListing?> watchApp(String appId) {
    return _apps.doc(appId).snapshots().map((doc) {
      if (!doc.exists) {
        return null;
      }
      return AppListing.fromDocument(doc);
    });
  }
}
