import React from 'react';
import { useTranslation } from 'react-i18next';
import { ClickableTile, Layer } from '@carbon/react';
import { careModelAdminUrl } from '../utils/care-model-navigation';
import { ArrowRight } from '@carbon/react/icons';

/**
 * System Administration card (design 4's admin angle): links to the Care Models registry and
 * designer. Visibility is gated on the manage privilege via the extension's "privileges"
 * registration in routes.json.
 */
const CareModelsAdminCardLink: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Layer>
      <ClickableTile href={careModelAdminUrl()}>
        <div>
          <div className="heading">{t('careModels', 'Care Models')}</div>
          <div className="content">{t('careModelsAdminCard', 'Create, manage and publish care models')}</div>
        </div>
        <div className="iconWrapper">
          <ArrowRight size={16} />
        </div>
      </ClickableTile>
    </Layer>
  );
};

export default CareModelsAdminCardLink;
