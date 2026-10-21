import { careModelAdminUrl, getModelCodeFromLocation, navigateToCareModelAdmin } from './care-model-navigation';
import { navigate } from '@openmrs/esm-framework';

it('uses native navigation and encodes model codes without requiring a Router', () => {
  expect(careModelAdminUrl()).toBe('/openmrs/spa/care-models-admin');
  navigateToCareModelAdmin('model/a', { replace: true });
  expect(navigate).toHaveBeenCalledWith({ to: '/openmrs/spa/care-models-admin/model%2Fa', replace: true });
});

it('reads existing and new model paths safely', () => {
  window.history.replaceState({}, '', '/openmrs/spa/care-models-admin/test-model');
  expect(getModelCodeFromLocation()).toBe('test-model');
  window.history.replaceState({}, '', '/openmrs/spa/care-models-admin/new');
  expect(getModelCodeFromLocation()).toBeNull();
  window.history.replaceState({}, '', '/openmrs/spa/care-models-admin/%invalid');
  expect(getModelCodeFromLocation()).toBeNull();
});

it('registers mutually exclusive shell pages for canonical and legacy URLs', async () => {
  const { default: routes } = await import('../routes.json');
  for (const path of ['care-models-admin', 'care-models-admin/', 'home/care-models-admin']) {
    expect(routes.pages.filter((page) => new RegExp(page.routeRegex).test(path)).map((page) => page.component)).toEqual(
      ['careModelsAdminHome'],
    );
  }
  for (const path of ['care-models-admin/new', 'care-models-admin/model', 'home/care-models-admin/model']) {
    expect(routes.pages.filter((page) => new RegExp(page.routeRegex).test(path)).map((page) => page.component)).toEqual(
      ['careModelsDesigner'],
    );
  }
});
