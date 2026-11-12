import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';

import '../models/app_listing.dart';
import '../models/participation.dart';
import '../models/user_profile.dart';
import '../services/app_service.dart';
import '../services/auth_service.dart';
import '../services/participation_service.dart';
import '../services/profile_service.dart';

class AppSession extends ChangeNotifier {
  AppSession({
    required AuthService authService,
    required ProfileService profileService,
    required AppService appService,
    required ParticipationService participationService,
  })  : _authService = authService,
        _profileService = profileService,
        _appService = appService,
        _participationService = participationService {
    _authSubscription = _authService.authStateChanges().listen(_handleAuthChange);
  }

  final AuthService _authService;
  final ProfileService _profileService;
  final AppService _appService;
  final ParticipationService _participationService;

  StreamSubscription<User?>? _authSubscription;
  StreamSubscription<UserProfile?>? _profileSubscription;
  StreamSubscription<List<AppListing>>? _myAppsSubscription;
  StreamSubscription<List<Participation>>? _myTestsSubscription;

  User? user;
  UserProfile? profile;
  List<AppListing> myApps = const [];
  List<Participation> myTests = const [];
  bool bootstrapComplete = false;
  bool isBusy = true;
  String? errorMessage;

  Future<void> _handleAuthChange(User? nextUser) async {
    user = nextUser;
    profile = null;
    myApps = const [];
    myTests = const [];
    errorMessage = null;
    isBusy = false;
    bootstrapComplete = true;
    notifyListeners();

    await _profileSubscription?.cancel();
    await _myAppsSubscription?.cancel();
    await _myTestsSubscription?.cancel();

    if (nextUser == null) {
      return;
    }

    _profileSubscription = _profileService.watchProfile(nextUser.uid).listen((value) {
      profile = value;
      notifyListeners();
    });

    _myAppsSubscription = _appService.watchMyApps(nextUser.uid).listen((value) {
      myApps = value;
      notifyListeners();
    });

    _myTestsSubscription = _participationService.watchMyParticipations(nextUser.uid).listen((value) {
      myTests = value;
      notifyListeners();
    });
  }

  Future<void> signInForDevelopment() async {
    isBusy = true;
    errorMessage = null;
    notifyListeners();

    try {
      await _authService.signInAnonymously();
    } catch (error) {
      errorMessage = '로그인에 실패했습니다. Firebase Auth 설정을 확인해주세요.';
    } finally {
      isBusy = false;
      notifyListeners();
    }
  }

  Future<void> signOut() async {
    isBusy = true;
    errorMessage = null;
    notifyListeners();

    try {
      await _authService.signOut();
    } catch (error) {
      errorMessage = '로그아웃에 실패했습니다.';
    } finally {
      isBusy = false;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _authSubscription?.cancel();
    _profileSubscription?.cancel();
    _myAppsSubscription?.cancel();
    _myTestsSubscription?.cancel();
    super.dispose();
  }
}
